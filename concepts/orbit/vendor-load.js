/* DIKMAN FM · ספריות התנועה (Anime.js + Motion, כ-300KB) נטענות רק בגרסה המלאה.
   בגרסה הקלה (מכשירים כשרים / מסוננים / חלשים) הן לא יורדות בכלל, והאתר עובד בלעדיהן.
   נכתבות כאן במקום, כדי שייטענו לפני הסקריפטים שאחריהן בדיוק כמו תגית רגילה. */
(function () {
  if (window.DKM_LITE) return;
  var me = document.currentScript, v = (me && me.getAttribute("data-v")) || "";
  var libs = ((me && me.getAttribute("data-libs")) || "anime motion").split(" ");
  var src = { anime: "vendor/anime-4.5.0.umd.min.js", motion: "vendor/motion-14.9.0.min.js" };
  for (var i = 0; i < libs.length; i++) if (src[libs[i]]) document.write('<script src="' + src[libs[i]] + (v ? "?v=" + v : "") + '"><\/script>');
})();
