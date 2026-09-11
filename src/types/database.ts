export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          role: 'student' | 'teacher' | 'staff' | 'admin' | 'super_admin';
          first_name: string;
          last_name: string;
          phone: string;
          title: string;
          bio: string;
          profession: string;
          is_public: boolean;
          avatar_url: string;
          display_order: number;
          updated_at: string;
        };
        Insert: Partial<{
          id: string;
          email: string;
          role: 'student' | 'teacher' | 'staff' | 'admin' | 'super_admin';
          [key: string]: unknown;
        }>;
        Update: Partial<Record<string, unknown>>;
      };
      students: {
        Row: {
          id: string;
          user_id: string | null;
          student_code: string;
          first_name: string;
          last_name: string;
          gender: 'male' | 'female' | 'other';
          grade: string;
          section: string;
          guardian_name: string;
          guardian_phone: string;
          address: string;
          birth_date: string | null;
          enrolled_at: string;
          math_score: number;
          logic_score: number;
          language_score: number;
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<{
          id: string;
          user_id: string | null;
          first_name: string;
          last_name: string;
          gender: string;
          grade: string;
          section: string;
          guardian_name: string;
          guardian_phone: string;
          address: string;
          birth_date: string | null;
          enrolled_at: string;
          math_score: number;
          logic_score: number;
          language_score: number;
          notes: string;
          [key: string]: unknown;
        }>;
        Update: Partial<Record<string, unknown>>;
      };
      attendance: {
        Row: {
          id: string;
          student_id: string;
          date: string;
          status: 'present' | 'absent' | 'excused' | 'late';
          note: string;
          recorded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<{
          id: string;
          student_id: string;
          date: string;
          status: string;
          note: string;
          recorded_by: string | null;
          [key: string]: unknown;
        }>;
        Update: Partial<Record<string, unknown>>;
      };
      messages: {
        Row: {
          id: string;
          name: string;
          email: string;
          country: string;
          role: string;
          subject: string;
          message: string;
          is_read: boolean;
          created_at: string;
        };
        Insert: Partial<{
          id: string;
          name: string;
          email: string;
          country: string;
          role: string;
          subject: string;
          message: string;
          [key: string]: unknown;
        }>;
        Update: Partial<Record<string, unknown>>;
      };
      partners: {
        Row: {
          id: string;
          name: string;
          slug: string;
          website: string;
          logo_url: string;
          description_en: string;
          description_am: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<{
          id: string;
          name: string;
          slug: string;
          website: string;
          logo_url: string;
          description_en: string;
          description_am: string;
          sort_order: number;
          is_active: boolean;
          [key: string]: unknown;
        }>;
        Update: Partial<Record<string, unknown>>;
      };
    media_showcase: {
        Row: {
          id: string;
          title: string;
          caption: string;
          media_url: string;
          media_type: 'image' | 'video' | 'interview';
          is_featured_video: boolean;
          display_order: number;
          created_at: string;
        };
        Insert: Partial<{
          id: string;
          title: string;
          caption: string;
          media_url: string;
          media_type: 'image' | 'video' | 'interview';
          is_featured_video: boolean;
          display_order: number;
          [key: string]: unknown;
        }>;
        Update: Partial<Record<string, unknown>>;
      };
    };
    Functions: {
      current_role: {
        Args: Record<string, never>;
        Returns: string;
      };
      is_staff: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_super_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
  };
};