export function renderTrendContainer() {
  return '<div id="trend-section" class="stagger-section fade-in-delay-4 card p-6 mb-8" style="opacity:0;display:none">' +
    '<h2 class="text-lg font-bold mb-4">Score History</h2>' +
    '<div class="max-w-xl mx-auto"><canvas id="trendChart"></canvas></div>' +
    '<p class="text-xs text-gray-500 text-center mt-3">Score trend for this URL over time</p>' +
  '</div>';
}

export async function initTrendChart(urlHistory) {
  var canvas = document.getElementById("trendChart");
  if (!canvas || !urlHistory || urlHistory.length < 2) {
    var section = document.getElementById("trend-section");
    if (section) section.style.display = "none";
    return null;
  }
  var section = document.getElementById("trend-section");
  if (section) section.style.display = "block";
  var Chart = await getChartJs();
  var reversed = urlHistory.slice().reverse();
  var chart = new Chart(canvas, {
    type: "line",
    data: {
      labels: reversed.map(function(e) {
        var d = new Date(e.timestamp);
        return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      }),
      datasets: [{
        label: "Score",
        data: reversed.map(function(e) { return e.score; }),
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59,130,246,0.1)",
        fill: true,
        tension: 0.3,
        pointBackgroundColor: reversed.map(function(e) {
          return e.score >= 80 ? "#22c55e" : e.score >= 60 ? "#3b82f6" : e.score >= 40 ? "#eab308" : "#ef4444";
        }),
        pointRadius: 4,
        pointBorderColor: "#1e293b",
        pointBorderWidth: 1.5,
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        x: {
          ticks: { color: "#64748b", font: { size: 10 } },
          grid: { color: "rgba(148,163,184,0.08)" }
        },
        y: {
          min: 0, max: 100,
          ticks: { color: "#64748b", font: { size: 10 }, stepSize: 20 },
          grid: { color: "rgba(148,163,184,0.08)" }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(15,23,42,0.95)",
          titleColor: "#e2e8f0",
          bodyColor: "#94a3b8",
          borderColor: "rgba(148,163,184,0.15)",
          borderWidth: 1,
          padding: 10,
          displayColors: false,
          callbacks: {
            label: function(ctx) { return "Score: " + ctx.parsed.y + "/100"; }
          }
        }
      }
    }
  });
  return chart;
}

async function getChartJs() {
  var mod = await import("chart.js");
  var Chart = mod.Chart;
  var registerables = mod.registerables;
  Chart.register(...registerables);
  return Chart;
}
