const detail = document.getElementById("detail");
const segmentList = document.getElementById("segmentList");
const metricTotal = document.getElementById("metricTotal");
const metricRelocate = document.getElementById("metricRelocate");
const metricConsult = document.getElementById("metricConsult");
const mapModeButtons = document.querySelectorAll(".map-mode");
let loadedSegments = [];

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
  center: [127.0512, 37.6569],
  zoom: 15
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
    const utilities = await fetchJson("./data/utilities.geojson");
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
        "fill-color": "#1d4ed8",
        "fill-opacity": 0.12
      }
    });

    map.addLayer({
      id: "site-line",
      type: "line",
      source: "site",
      paint: {
        "line-color": "#1d4ed8",
        "line-width": 3,
        "line-dasharray": [2, 1]
      }
    });

    map.addSource("utilities", {
      type: "geojson",
      data: utilities
    });

    map.addLayer({
      id: "utility-sewer",
      type: "line",
      source: "utilities",
      filter: ["==", ["get", "kind"], "sewer"],
      paint: {
        "line-color": "#7c3aed",
        "line-width": 4,
        "line-dasharray": [2, 1],
        "line-opacity": 0.9
      }
    });

    map.addLayer({
      id: "utility-water",
      type: "line",
      source: "utilities",
      filter: ["==", ["get", "kind"], "water"],
      paint: {
        "line-color": "#0284c7",
        "line-width": 4,
        "line-opacity": 0.85
      }
    });

    if (Array.isArray(risks) && risks.length > 0) {
      loadedSegments = risks;
      renderMetrics(risks);
      renderSegmentList(risks);

      map.addSource("segments", {
        type: "geojson",
        data: risksToGeoJson(risks)
      });

      map.addLayer({
        id: "segment-points",
        type: "circle",
        source: "segments",
        paint: {
          "circle-radius": 10,
          "circle-color": [
            "match",
            ["get", "status"],
            "relocation", "#dc2626",
            "consultation", "#f59e0b",
            "#64748b"
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 3
        }
      });

      map.on("mouseenter", "segment-points", () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", "segment-points", () => {
        map.getCanvas().style.cursor = "";
      });

      map.on("click", "segment-points", (event) => {
        const segment = event.features[0].properties;
        selectSegment(segment.id);
      });

      selectSegment(risks[0].id);
    }
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

function renderMetrics(segments) {
  metricTotal.textContent = String(segments.length);
  metricRelocate.textContent = String(segments.filter((item) => item.status === "relocation").length);
  metricConsult.textContent = String(segments.filter((item) => item.status === "consultation").length);
}

function renderSegmentList(segments) {
  segmentList.innerHTML = segments
    .map((item) => `
      <button class="segment-item" type="button" data-segment-id="${escapeHtml(item.id)}">
        <span class="segment-title">
          <b>${escapeHtml(item.title)}</b>
          <span class="chip ${escapeHtml(item.status)}">${escapeHtml(item.statusLabel)}</span>
        </span>
        <p>${escapeHtml(item.deadline)}</p>
      </button>
    `)
    .join("");

  segmentList.querySelectorAll(".segment-item").forEach((button) => {
    button.addEventListener("click", () => {
      selectSegment(button.dataset.segmentId);
    });
  });
}

function selectSegment(id) {
  const segment = loadedSegments.find((item) => item.id === id);
  if (!segment) return;

  renderDetail(segment);
  segmentList.querySelectorAll(".segment-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.segmentId === id);
  });

  map.easeTo({
    center: [Number(segment.lng), Number(segment.lat)],
    zoom: Math.max(map.getZoom(), 16),
    duration: 650
  });
}

function renderDetail(segment) {
  if (!segment) return;

  detail.innerHTML = `
    <h2>${escapeHtml(segment.title)} <span class="chip ${escapeHtml(segment.status)}">${escapeHtml(segment.statusLabel)}</span></h2>
    <div class="detail-grid">
      <div class="mini-stat">
        <span>협의기관</span>
        <b>${escapeHtml(segment.owner)}</b>
      </div>
      <div class="mini-stat">
        <span>처리상태</span>
        <b>${escapeHtml(segment.history)}</b>
      </div>
    </div>
    <div class="detail-card">
      <div class="detail-row">
        <b>협의 필요 기한</b>
        ${escapeHtml(segment.deadline)}
      </div>
      <div class="detail-row">
        <b>판단 사유</b>
        ${escapeHtml(segment.reason)}
      </div>
      <div class="detail-row">
        <b>착공 영향</b>
        ${escapeHtml(segment.constructionImpact)}
      </div>
      <div class="detail-row">
        <b>필요 조치</b>
        ${escapeHtml(segment.requiredAction)}
      </div>
      <div class="detail-row alt">
        <b>검토 대안</b>
        ${escapeHtml(segment.alternative)}
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
