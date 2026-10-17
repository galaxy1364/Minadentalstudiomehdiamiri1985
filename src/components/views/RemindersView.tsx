import React, { useState } from 'react';
import { 
  BellRing, Send, CheckCircle2, MessageSquare, Clock, 
  ShieldCheck, HeartPulse, Sparkles, Plus, Check,
  Smartphone, User, RefreshCw
} from 'lucide-react';
import { toPersianDigits } from '../../utils/jalali';

export const RemindersView: React.FC = () => {
  const [sentAlert, setSentAlert] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'composer' | 'logs'>('pending');

  // Custom SMS composer states
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [smsText, setSmsText] = useState('سلام؛ نوبت دندانپزشکی شما فردا ساعت ۱۷:۰۰ در کلینیک دندانپزشکی مینادنتال رزرو شده است. لطفاً در صورت عدم حضور ۱۰ ساعت قبل اطلاع دهید.');

  const [logs, setLogs] = useState([
    { id: 'l1', to: 'علی مرادی', phone: '۰۹۱۲۳۴۵۶۷۸۹', text: 'روکش زیرکونیا دندان ۶ آماده تحویل در کلینیک است.', time: 'امروز ۱۰:۱۵', status: 'تحویل شده' },
    { id: 'l2', to: 'سارا رضایی', phone: '۰۹۱۹۸۷۶۵۴۳۲', text: 'یادآوری سررسید چک صیادی تاریخ ۲۵ آبان به مبلغ ۱۰ میلیون تومان.', time: 'دیروز ۱۸:۳۰', status: 'تحویل شده' },
    { id: 'l3', to: 'محمد حسینی', phone: '۰۹۳۵۱۱۱۱۱۱۱', text: 'دستورات پس از جراحی ایمپلنت: کمپرس سرد و مصرف آنتی‌بیوتیک.', time: '۱۴۰۳/۰۸/۱۴', status: 'تحویل شده' },
  ]);

  const remindersList = [
    {
      id: 'r1',
      title: 'یادآوری تحویل کار لابراتوار (UR5 علی مرادی)',
      subtitle: 'نوبت بیمار فردا ساعت ۱۶:۳۰ است. روکش زیرکونیا آماده و در مطب دریافت شده است.',
      type: 'lab',
      time: 'امروز ساعت ۱۴:۰۰',
      actionText: 'ارسال پیامک آماده بودن روکش'
    },
    {
      id: 'r2',
      title: 'یادآوری سررسید چک صیادی (۱۰ میلیون تومان)',
      subtitle: 'چک صیادی شماره ۷۳۰۱۸۴۹۲۱۶۴۸۵۲۱۰ در تاریخ ۲۵ آبان سررسید می‌شود.',
      type: 'financial',
      time: '۳ روز دیگر',
      actionText: 'ارسال پیامک یادآوری چک'
    },
    {
      id: 'r3',
      title: 'پیگیری پس از جراحی ایمپلنت دندان ۶',
      subtitle: 'ارسال دستورات پس از جراحی، شستشو با کلرهگزیدین و مصرف آنتی‌بیوتیک به بیمار.',
      type: 'post_op',
      time: 'ساعت ۱۸:۰۰',
      actionText: 'ارسال پیامک مراقبت جراحی'
    },
    {
      id: 'r4',
      title: 'یادآوری دوره استئواینتگریشن فیکسچر',
      subtitle: 'موعد بررسی رادیوگرافی و بستن هیلینگ کپ (Healing Abutment) در تاریخ ۱۵ آذرماه.',
      type: 'implant',
      time: '۱۵ آذر',
      actionText: 'ثبت در تقویم نوبت‌دهی'
    }
  ];

  const templates = [
    { title: 'تایید و یادآوری نوبت', text: 'سلام؛ نوبت ویزیت و درمان شما در کلینیک دندانپزشکی فردا ساعت [ساعت] ثبت شده است.' },
    { title: 'مراقبت‌های بعد جراحی / کشیدن', text: 'بیمار گرامی؛ لطفاً گاز استریل را تا ۱ ساعت روی موضع فشار داده و از شستشوی دهان تا ۲۴ ساعت خودداری فرمایید.' },
    { title: 'آماده بودن روکش / لابراتوار', text: 'بیمار گرامی؛ کار پروتزی / روکش شما از لابراتوار واصل شده است. لطفاً جهت تنظیم وقت تماس حاصل فرمایید.' },
    { title: 'سررسید چک صیادی', text: 'احتراماً یادآوری می‌شود موعد سررسید چک صیادی شما در تاریخ [تاریخ] نزدیک است.' },
  ];

  const handleSend = (title: string, phone = '۰۹۱۲۰۰۰۰۰۰۰') => {
    setSentAlert(`پیامک "${title}" با موفقیت به گیرنده ارسال گردید.`);
    setTimeout(() => setSentAlert(null), 3500);

    setLogs([
      { id: `l-${Date.now()}`, to: recipientName || 'بیمار', phone: recipientPhone || phone, text: title, time: 'هم‌اکنون', status: 'تحویل شده' },
      ...logs
    ]);
  };

  const handleSendCustomSms = (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsText) return;
    handleSend(smsText, recipientPhone || '۰۹۱۲۰۰۰۰۰۰۰');
    setRecipientName('');
    setRecipientPhone('');
  };

  return (
    <div className="pb-28 space-y-3">
      {/* Top Banner */}
      <div className="mx-2 mt-2">
        <div className="bg-white rounded-[24px] p-3.5 shadow-sm border border-slate-100 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <BellRing className="w-4 h-4" />
              </div>
              <h3 className="font-black text-sm text-slate-800">پیامک و یادآوری</h3>
            </div>

            <div className="flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-mono font-bold">
              <span>شارژ پنل: ۳,۸۵۰ پیامک</span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'pending' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
              }`}
            >
              هشدارهای هوشمند ({toPersianDigits(remindersList.length)})
            </button>
            <button
              onClick={() => setActiveTab('composer')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'composer' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
              }`}
            >
              ارسال پیامک دلخواه
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'logs' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
              }`}
            >
              گزارش ارسال‌ها
            </button>
          </div>
        </div>
      </div>

      {sentAlert && (
        <div className="mx-2 p-3 rounded-2xl bg-[#142518] border border-[#c8ff00]/60 text-white font-bold text-xs flex items-center gap-2 shadow-lg animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-[#c8ff00] shrink-0" />
          <span>{sentAlert}</span>
        </div>
      )}

      {/* TAB 1: PENDING SMART REMINDERS */}
      {activeTab === 'pending' && (
        <div className="mx-2 space-y-2.5">
          {remindersList.map(item => (
            <div
              key={item.id}
              className="bg-white rounded-[22px] p-3.5 shadow-2xs border border-slate-100 space-y-2 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xs font-black text-slate-900 leading-snug">{item.title}</h4>
                  <span className="text-[10px] text-slate-400 mt-0.5 block font-mono">{toPersianDigits(item.time)}</span>
                </div>

                <span className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-emerald-700 shrink-0">
                  {item.type === 'lab' && <MessageSquare className="w-4 h-4" />}
                  {item.type === 'financial' && <ShieldCheck className="w-4 h-4" />}
                  {item.type === 'post_op' && <HeartPulse className="w-4 h-4" />}
                  {item.type === 'implant' && <Clock className="w-4 h-4" />}
                </span>
              </div>

              <p className="text-[11px] text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                {item.subtitle}
              </p>

              <div className="flex justify-end pt-1">
                <button
                  onClick={() => handleSend(item.title)}
                  className="py-1.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs active:scale-95 transition-all"
                >
                  <Send className="w-3.5 h-3.5 -scale-x-100" />
                  <span>{item.actionText}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: CUSTOM SMS COMPOSER */}
      {activeTab === 'composer' && (
        <div className="mx-2 space-y-2.5">
          {/* Quick template buttons */}
          <div className="bg-white rounded-[22px] p-3.5 shadow-2xs border border-slate-100 space-y-2">
            <span className="text-xs font-black text-slate-800 block">قالب‌های بالینی آماده:</span>
            <div className="grid grid-cols-2 gap-1.5">
              {templates.map((tpl, i) => (
                <button
                  key={i}
                  onClick={() => setSmsText(tpl.text)}
                  className="text-right p-2 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200/80 text-[11px] font-bold text-slate-700 hover:text-emerald-800 transition-all"
                >
                  ⚡ {tpl.title}
                </button>
              ))}
            </div>
          </div>

          {/* Composer Box */}
          <div className="bg-white rounded-[22px] p-3.5 shadow-2xs border border-slate-100 space-y-3">
            <span className="text-xs font-black text-slate-800 block">متن و گیرنده پیامک:</span>

            <form onSubmit={handleSendCustomSms} className="space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-600 font-bold block mb-1">نام مخاطب</label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="مثلاً: علی مرادی"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-600 font-bold block mb-1">شماره موبایل *</label>
                  <input
                    type="text"
                    required
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-600 font-bold block mb-1 flex items-center justify-between">
                  <span>متن پیامک</span>
                  <span className="text-[10px] text-slate-400 font-mono">{toPersianDigits(smsText.length)} کاراکتر (۱ پیامک فارسی)</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={smsText}
                  onChange={(e) => setSmsText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 text-xs focus:outline-none leading-relaxed"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-rose-600/25 active:scale-95 transition-all"
              >
                <Send className="w-4 h-4 -scale-x-100" />
                <span>ارسال فوری پیامک از طریق خط خدماتی</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: LOGS & HISTORY */}
      {activeTab === 'logs' && (
        <div className="mx-2 space-y-2">
          {logs.map(log => (
            <div
              key={log.id}
              className="bg-white rounded-[20px] p-3 shadow-2xs border border-slate-100 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900">{log.to}</span>
                  <span className="text-[10px] text-slate-400 font-mono">({log.phone})</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  {log.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed bg-slate-50 p-2 rounded-lg">
                {log.text}
              </p>
              <span className="text-[9px] text-slate-400 block text-left font-mono">{toPersianDigits(log.time)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
