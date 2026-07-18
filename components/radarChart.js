const LABELS = { aiCrawlability: "AI Crawlability", aiGuidance: "AI Guidance", structuredData: "Structured Data", metaSocial: "Meta & Social", contentQuality: "Content Quality", eeat: "E-E-A-T", brandEntity: "Brand & Entity", citationReadiness: "Citation Readiness", discoveryEndpoints: "Discovery", agentFriendliness: "Agent Friendly", freshness: "Freshness" };
const COLORS = ["#22c55e","#3b82f6","#8b5cf6","#f59e0b","#ec4899","#06b6d4","#10b981","#f97316","#6366f1","#14b8a6","#e11d48"];

export function renderRadarContainer() {
  return '<div class="stagger-section fade-in-delay-2 card p-6 mb-8"><div class="max-w-md mx-auto"><canvas id="radarChart"></canvas></div></div>';
}

export async function initRadarChart(dimensions) {
  var canvas = document.getElementById("radarChart");
  if (!canvas) return null;
  var Chart = await getChartJs();
  var dimKeys = Object.keys(dimensions);
  var chart = new Chart(canvas, {
    type: "radar",
    data: {
      labels: dimKeys.map(function(k) { return LABELS[k] || k; }),
      datasets: [{
        label: "GEO Score",
        data: dimKeys.map(function(k) { var d = dimensions[k]; return d.percentage || 0; }),
        backgroundColor: "rgba(59, 130, 246, 0.12)",
        borderColor: "#3b82f6",
        borderWidth: 2,
        pointBackgroundColor: COLORS,
        pointBorderColor: "#1e293b",
        pointBorderWidth: 1.5,
        pointRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          ticks: { display: false, stepSize: 20 },
          grid: { color: "rgba(148, 163, 184, 0.12)" },
          angleLines: { color: "rgba(148, 163, 184, 0.12)" },
          pointLabels: { color: "#94a3b8", font: { size: 11, family: "system-ui, -apple-system, sans-serif" } }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.95)",
          titleColor: "#e2e8f0",
          bodyColor: "#94a3b8",
          borderColor: "rgba(148,163,184,0.15)",
          borderWidth: 1,
          padding: 10,
          displayColors: false
        }
      }
    }
  });
  return chart;
}

async function getChartJs() {
  var mod = await import('chart.js');
  var Chart = mod.Chart;
  var registerables = mod.registerables;
  Chart.register(...registerables);
  return Chart;
}
