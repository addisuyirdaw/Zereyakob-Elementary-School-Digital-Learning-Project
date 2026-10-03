-- Migration 00016_khan_import_rpc
-- Description: Creates the transactional RPC for inserting Khan Academy imports safely.

-- Use SECURITY INVOKER so the function respects all existing RLS on khan_imports, 
-- khan_student_mappings, and khan_learning_records.

CREATE OR REPLACE FUNCTION public.fn_insert_khan_batch(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_file_hash text;
  v_storage_path text;
  v_original_filename text;
  v_report_date date;
  v_grade text;
  v_subject text;
  v_school_class_name text;
  
  v_import_id uuid;
  v_constraint_name text;
  
  rec record;
  
  v_status text;
  v_score_percentage int;
  v_progress_current int;
  v_progress_total int;
  v_category_level text;
  v_activity_skill text;
  v_khan_student_name text;

  inserted_count int := 0;
BEGIN
  -- 1. Enforce Authentication and establish Authoritative Identity
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Extract and strictly validate metadata
  v_file_hash := payload->>'file_hash';
  v_storage_path := payload->>'storage_path';
  v_original_filename := payload->>'original_filename';
  v_report_date := (payload->>'report_date')::date;
  v_grade := payload->>'grade';
  v_subject := payload->>'subject';
  v_school_class_name := payload->>'school_class_name';

  IF COALESCE(v_file_hash, '') = '' THEN RAISE EXCEPTION 'file_hash is required'; END IF;
  IF COALESCE(v_storage_path, '') = '' THEN RAISE EXCEPTION 'storage_path is required'; END IF;
  IF COALESCE(v_school_class_name, '') = '' THEN RAISE EXCEPTION 'school_class_name is required'; END IF;

  -- 3. Atomic Insert into khan_imports
  BEGIN
    INSERT INTO public.khan_imports (
      uploaded_by,
      original_filename,
      file_hash,
      storage_path,
      report_date,
      grade,
      subject,
      school_class_name
    ) VALUES (
      v_uid, -- Explicitly use server-side uid, ignore any client provided value
      v_original_filename,
      v_file_hash,
      v_storage_path,
      v_report_date,
      v_grade,
      v_subject,
      v_school_class_name
    ) RETURNING id INTO v_import_id;
  EXCEPTION WHEN unique_violation THEN
    -- Check if it's explicitly the file_hash constraint that was violated
    GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;
    IF v_constraint_name = 'khan_imports_file_hash_key' THEN
      RAISE EXCEPTION 'DUPLICATE_FILE: This exact file has already been imported.';
    ELSE
      RAISE EXCEPTION 'Unique violation: %', v_constraint_name;
    END IF;
  END;

  -- 4. Safely Loop and Validate Learning Records
  FOR rec IN SELECT * FROM jsonb_array_elements(payload->'records') LOOP
    v_khan_student_name := rec.value->>'student';
    IF COALESCE(v_khan_student_name, '') = '' THEN
      RAISE EXCEPTION 'student name is required';
    END IF;

    -- Ensure mapping exists: ON CONFLICT DO NOTHING relies on the unique index
    -- (khan_student_name, school_class_name). Automatically defaults student_id to NULL.
    INSERT INTO public.khan_student_mappings (
      khan_student_name,
      school_class_name,
      student_id
    ) VALUES (
      v_khan_student_name,
      v_school_class_name,
      NULL
    )
    ON CONFLICT (khan_student_name, school_class_name) DO NOTHING;

    -- Extract and validate learning record fields strictly
    v_status := rec.value->>'status';
    IF v_status NOT IN ('viewed', 'attempted', 'unattempted') THEN
      RAISE EXCEPTION 'Invalid status: %', v_status;
    END IF;

    -- Safely cast empty strings to null or integers
    IF rec.value->>'scorePercentage' IS NOT NULL AND rec.value->>'scorePercentage' <> '' THEN
      v_score_percentage := (rec.value->>'scorePercentage')::int;
      IF v_score_percentage < 0 OR v_score_percentage > 100 THEN
        RAISE EXCEPTION 'Invalid score_percentage: %', v_score_percentage;
      END IF;
    ELSE
      v_score_percentage := NULL;
    END IF;

    -- Enforce semantic rule: 'viewed' must never receive a fabricated score
    IF v_status = 'viewed' AND v_score_percentage IS NOT NULL THEN
      RAISE EXCEPTION 'Status viewed cannot have a score_percentage';
    END IF;

    IF rec.value->>'progressCurrent' IS NOT NULL AND rec.value->>'progressCurrent' <> '' THEN
      v_progress_current := (rec.value->>'progressCurrent')::int;
      IF v_progress_current < 0 THEN
        RAISE EXCEPTION 'Invalid progress_current: %', v_progress_current;
      END IF;
    ELSE
      v_progress_current := NULL;
    END IF;

    IF rec.value->>'progressTotal' IS NOT NULL AND rec.value->>'progressTotal' <> '' THEN
      v_progress_total := (rec.value->>'progressTotal')::int;
      IF v_progress_total <= 0 THEN
        RAISE EXCEPTION 'Invalid progress_total: %', v_progress_total;
      END IF;
    ELSE
      v_progress_total := NULL;
    END IF;

    v_category_level := rec.value->>'level';
    IF COALESCE(v_category_level, '') = '' THEN
      RAISE EXCEPTION 'category_level is required';
    END IF;

    v_activity_skill := rec.value->>'activitySkill';
    IF COALESCE(v_activity_skill, '') = '' THEN
      RAISE EXCEPTION 'activity_skill is required';
    END IF;

    -- Insert learning record using the exact schema columns
    INSERT INTO public.khan_learning_records (
      import_id,
      khan_student_name,
      category_level,
      activity_skill,
      progress_current,
      progress_total,
      score_percentage,
      status
    ) VALUES (
      v_import_id,
      v_khan_student_name,
      v_category_level,
      v_activity_skill,
      v_progress_current,
      v_progress_total,
      v_score_percentage,
      v_status
    );

    inserted_count := inserted_count + 1;
  END LOOP;

  -- 5. Return summary payload
  RETURN jsonb_build_object(
    'success', true,
    'import_id', v_import_id,
    'records_inserted', inserted_count
  );
END;
$$;

-- Explicitly revoke access from public/anon
REVOKE EXECUTE ON FUNCTION public.fn_insert_khan_batch(JSONB) FROM public;
REVOKE EXECUTE ON FUNCTION public.fn_insert_khan_batch(JSONB) FROM anon;

-- Explicitly grant access ONLY to authenticated users.
-- RLS policies will further restrict which authenticated users (is_staff) can successfully run it.
GRANT EXECUTE ON FUNCTION public.fn_insert_khan_batch(JSONB) TO authenticated;
