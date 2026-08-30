import React from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

const FAQModal: React.FC = () => {
  const { isFAQOpen, toggleFAQ, t } = useAppContext();
  const [openIndex, setOpenIndex] = React.useState<number | null>(0);

  const faqData = [
    { question: t('faq_q1'), answer: t('faq_a1') },
    { question: t('faq_q2'), answer: t('faq_a2') },
    { question: t('faq_q3'), answer: t('faq_a3') },
    { question: t('faq_q4'), answer: t('faq_a4') },
    { question: t('faq_q5'), answer: t('faq_a5') },
  ];

  if (!isFAQOpen) return null;

  const toggleAnswer = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
        <button
          onClick={toggleFAQ}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 transition"
        >
          <X size={24} />
        </button>
        <div className="p-8">
          <h1 className="text-3xl font-extrabold text-slate-900 mb-8 text-center">{t('faq_title')}</h1>
          <div className="space-y-4">
            {faqData.map((item, index) => (
              <div key={index} className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <button
                  onClick={() => toggleAnswer(index)}
                  className="w-full flex items-center justify-between p-6 text-left font-bold text-slate-800 hover:bg-slate-50 transition"
                >
                  {item.question}
                  {openIndex === index ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
                {openIndex === index && (
                  <div className="p-6 pt-0 text-slate-600 leading-relaxed border-t border-slate-100">
                    {item.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FAQModal;
