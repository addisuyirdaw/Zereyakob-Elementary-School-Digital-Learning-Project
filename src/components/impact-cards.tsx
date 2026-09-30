"use client";

import { useLang } from "@/lib/i18n/LanguageProvider";
import { ArrowRight } from "lucide-react";

const IMPACT_STORIES = [
  {
    id: 1,
    image: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=800",
    categoryEn: "Pilot Program",
    categoryAm: "የሙከራ ፕሮግራም",
    titleEn: "First Round Success: 15 Students Graduate",
    titleAm: "የመጀመሪያ ዙር ስኬት፡ 15 ተማሪዎች ተመረቁ",
    descEn: "Our inaugural digital learning program concludes with incredible growth in logic and language skills.",
    descAm: "የእኛ የመጀመሪያ ዲጂታል ትምህርት ፕሮግራም በአመክንዮ እና ቋንቋ ክህሎቶች አስደናቂ እድገት ተጠናቀቀ።",
    link: "/about"
  },
  {
    id: 2,
    image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=800",
    categoryEn: "Teacher Excellence",
    categoryAm: "የመምህራን ብቃት",
    titleEn: "Empowering Educators with Tech",
    titleAm: "መምህራንን በቴክኖሎጂ ማብቃት",
    descEn: "Three dedicated teachers recognized for integrating tablet-based learning into daily curriculum.",
    descAm: "ሶስት የተለዩ መምህራን ታብሌት ላይ የተመሰረተ ትምህርትን በዕለታዊ ስርዓተ ትምህርት በማዋሃዳቸው እውቅና አግኝተዋል።",
    link: "/about"
  },
  {
    id: 3,
    image: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&q=80&w=800",
    categoryEn: "Community",
    categoryAm: "ማህበረሰብ",
    titleEn: "University Clubs Join Hands",
    titleAm: "የዩኒቨርሲቲ ክለቦች ተባበሩ",
    descEn: "11 DBU clubs providing mentorship and supplies to rural students.",
    descAm: "11 የደብረ ብርሃን ዩኒቨርሲቲ ክለቦች ለገጠር ተማሪዎች የምክር እና ቁሳቁስ ድጋፍ ያደርጋሉ።",
    link: "/about"
  }
];

export function ImpactCards() {
  const { lang } = useLang();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {IMPACT_STORIES.map((story) => (
        <a
          key={story.id}
          href={story.link}
          className="group flex flex-col justify-between overflow-hidden rounded-3xl bg-white p-8 shadow-xl shadow-slate-900/5 hover:shadow-2xl hover:shadow-royal-900/15 transition-all duration-300 border border-slate-100 hover:-translate-y-2 hover:border-royal-200"
        >
          <div>
            <span className="inline-flex items-center rounded-full bg-royal-50 px-3 py-1 text-xs font-bold text-royal-700 shadow-sm border border-royal-100 mb-5">
              {lang === "en" ? story.categoryEn : story.categoryAm}
            </span>
            <h3 className="text-xl font-extrabold text-slate-900 group-hover:text-royal-700 transition-colors leading-tight">
              {lang === "en" ? story.titleEn : story.titleAm}
            </h3>
            <p className="mt-4 text-sm text-slate-600 line-clamp-4 leading-relaxed">
              {lang === "en" ? story.descEn : story.descAm}
            </p>
          </div>
          <div className="mt-8 flex items-center text-sm font-bold text-royal-600">
            {lang === "en" ? "Read story" : "ታሪኩን ያንብቡ"}
            <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-2" />
          </div>
        </a>
      ))}
    </div>
  );
}
