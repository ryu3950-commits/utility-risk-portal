const detail = document.getElementById("detail");
const mapModeButtons = document.querySelectorAll(".map-mode");

const map = new maplibregl.Map({
  container: "map",
  style: {
    version: 8,
    sources: {
      plan: {
        type: "raster",
        tiles: ["https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors © CARTO"
      },
      satellite: {
        type: "raster",
        tiles: ["https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256,
        attribution: "Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
      }
    },
    layers: [
      {
        id: "plan",
        type: "raster",
        source: "plan"
      },
      {
        id: "satellite",
        type: "raster",
        source: "satellite",
        layout: {
          visibility: "none"
        },
        paint: {
          "raster-opacity": 0.92
        }
      }
    ]
  },
  center: [127.0517, 37.6565],
  zoom: 14
});

map.addControl(new maplibregl.NavigationControl(), "top-right");

mapModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const mode = button.dataset.mapMode;
    setMapMode(mode);
  });
});

function setMapMode(mode) {
  const isSatellite = mode === "satellite";
  map.setLayoutProperty("plan", "visibility", isSatellite ? "none" : "visible");
  map.setLayoutProperty("satellite", "visibility", isSatellite ? "visible" : "none");

  mapModeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mapMode === mode);
  });
}

map.on("load", async () => {
  try {
    const site = await fetchJson("./data/site.geojson");
    const risks = await fetchJson("./data/riskdata.json");

    map.addSource("site", {
      type: "geojson",
      data: site
    });

    map.addLayer({
      id: "site-fill",
      type: "fill",
      source: "site",
      paint: {
        "fill-color": "#0f766e",
        "fill-opacity": 0.16
      }
    });

    map.addLayer({
      id: "site-line",
      type: "line",
      source: "site",
      paint: {
        "line-color": "#0f766e",
        "line-width": 3,
        "line-dasharray": [2, 1]
      }
    });

    map.addSource("risks", {
      type: "geojson",
      data: risksToGeoJson(risks)
    });

    map.addLayer({
      id: "risk-points",
      type: "circle",
      source: "risks",
      paint: {
        "circle-radius": 9,
        "circle-color": [
          "match",
          ["get", "level"],
          "상", "#dc2626",
          "중", "#f97316",
          "하", "#2563eb",
          "#64748b"
        ],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 3
      }
    });

    map.on("mouseenter", "risk-points", () => {
      map.getCanvas().style.cursor = "pointer";
    });

    map.on("mouseleave", "risk-points", () => {
      map.getCanvas().style.cursor = "";
    });

    map.on("click", "risk-points", (event) => {
      const risk = event.features[0].properties;
      renderDetail(risk);
    });

    renderDetail(risks[0]);
  } catch (error) {
    detail.innerHTML = `
      <h2>로드 오류</h2>
      <p class="muted">${escapeHtml(error.message)}</p>
      <p class="muted">GitHub에 docs/data/site.geojson, docs/data/riskdata.json 파일이 있는지 확인하세요.</p>
    `;
  }
});

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${path} 파일을 불러오지 못했습니다. (${response.status})`);
  }
  return response.json();
}

function risksToGeoJson(risks) {
  return {
    type: "FeatureCollection",
    features: risks.map((risk) => ({
      type: "Feature",
      properties: risk,
      geometry: {
        type: "Point",
        coordinates: [Number(risk.lng), Number(risk.lat)]
      }
    }))
  };
}

function renderDetail(risk) {
  if (!risk) return;

  detail.innerHTML = `
    <h2>${escapeHtml(risk.type)} <span class="label">위험도 ${escapeHtml(risk.level)}</span></h2>
    <div class="detail-card">
      <div class="detail-row">
        <b>원인</b>
        ${escapeHtml(risk.cause)}
      </div>
      <div class="detail-row">
        <b>예상 영향</b>
        ${escapeHtml(risk.impact)}
      </div>
      <div class="detail-row">
        <b>CM 조치방안</b>
        ${escapeHtml(risk.action)}
      </div>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
