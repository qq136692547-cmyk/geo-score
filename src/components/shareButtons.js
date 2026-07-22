/**
 * Share buttons component — renders social share buttons after audit report.
 * Supports Twitter/X, LinkedIn, Reddit, and copy-link.
 */
import ICONS from '../lib/icons.js';

export function renderShareButtons(result) {
  var url = encodeURIComponent(result.url);
  var score = result.score;
  var level = result.level;
  var shareUrl = encodeURIComponent('https://geoscore.help/?audit=' + url);
  var shareText = encodeURIComponent('My site scored ' + score + '/100 (' + level + ') on GeoScore — the GEO readiness audit. Check yours:');

  return '<div class="stagger-section fade-in-delay-8 card p-6 mb-8">' +
    '<h3 class="text-sm font-bold text-gray-300 mb-4 flex items-center gap-2">' +
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>' +
    'Share Your Score' +
    '</h3>' +
    '<div class="flex flex-wrap gap-3">' +
      // Twitter/X
      '<a href="https://twitter.com/intent/tweet?text=' + shareText + '&url=' + shareUrl + '" target="_blank" rel="noopener" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white/10 hover:bg-white/20 transition" data-share="twitter">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>' +
        'Post on X' +
      '</a>' +
      // LinkedIn
      '<a href="https://www.linkedin.com/sharing/share-offsite/?url=' + shareUrl + '" target="_blank" rel="noopener" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white/10 hover:bg-white/20 transition" data-share="linkedin">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>' +
        'Share on LinkedIn' +
      '</a>' +
      // Reddit
      '<a href="https://www.reddit.com/submit?url=' + shareUrl + '&title=' + shareText + '" target="_blank" rel="noopener" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white/10 hover:bg-white/20 transition" data-share="reddit">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 11.779c0-1.459-1.192-2.645-2.657-2.645-.715 0-1.363.286-1.84.746-1.81-1.191-4.259-1.949-6.971-2.046l1.483-4.669 4.016.941-.006.058c0 1.193.975 2.163 2.174 2.163 1.198 0 2.172-.97 2.172-2.163s-.975-2.164-2.172-2.164c-.92 0-1.704.574-2.021 1.379l-4.329-1.015c-.189-.046-.381.063-.44.249l-1.654 5.207c-2.838.034-5.409.798-7.3 2.025-.474-.438-1.103-.712-1.799-.712-1.465 0-2.656 1.187-2.656 2.646 0 .97.533 1.811 1.317 2.271-.052.282-.086.567-.086.857 0 3.911 4.808 7.093 10.719 7.093s10.72-3.182 10.72-7.093c0-.274-.029-.544-.075-.81.832-.432 1.416-1.262 1.416-2.273zm-12.357 3.905c0 .583-.474 1.056-1.058 1.056-.583 0-1.057-.473-1.057-1.056 0-.583.474-1.056 1.057-1.056.584 0 1.058.473 1.058 1.056zm.244 2.844c-.032-.024-.073-.034-.112-.024-.039.01-.071.038-.088.075-.265.576-1.476.864-2.012.864-.536 0-1.747-.288-2.012-.864-.017-.037-.049-.065-.088-.075-.039-.01-.08 0-.112.024-.033.024-.052.062-.052.103 0 .837 1.334 1.476 2.264 1.476s2.264-.639 2.264-1.476c0-.041-.019-.079-.052-.103zm5.281-1.788c-.583 0-1.057-.473-1.057-1.056 0-.583.474-1.056 1.057-1.056.584 0 1.058.473 1.058 1.056 0 .583-.474 1.056-1.058 1.056z"/></svg>' +
        'Share on Reddit' +
      '</a>' +
      // Copy link
      '<button onclick="copyShareLink(\'' + result.url + '\')" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white/10 hover:bg-white/20 transition" data-share="copy">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>' +
        '<span id="copy-label">Copy Link</span>' +
      '</button>' +
    '</div>' +
    // Embed badge section
    '<div class="mt-4 pt-4 border-t border-gray-700/50">' +
      '<p class="text-xs text-gray-500 mb-2">Embed this score on your site:</p>' +
      '<code class="text-xs text-gray-400 bg-black/30 px-3 py-2 rounded-lg block overflow-x-auto">&lt;a href="https://geoscore.help/?audit=' + encodeURIComponent(result.url) + '"&gt;&lt;img src="https://geoscore.help/badge/' + encodeURIComponent(result.url) + '" alt="GEO Score: ' + score + '/100" /&gt;&lt;/a&gt;</code>' +
    '</div>' +
  '</div>';
}
