const map = new maplibregl.Map({
  container: "map",
  style: "https://demotiles.maplibre.org/style.json",
  center: [127.0517, 37.6565],
  zoom: 14
});

map.on("load", async () => {
  const res = await fetch("./data/site.geojson");
  const site = await res.json();

  map.addSource("site", {
    type: "geojson",
    data: site
  });

  map.addLayer({
    id: "site-fill",
    type: "fill",
    source: "site",
    paint: {
      "fill-color": "#2563eb",
      "fill-opacity": 0.18
    }
  });

  map.addLayer({
    id: "site-line",
    type: "line",
    source: "site",
    paint: {
      "line-color": "#1d4ed8",
      "line-width": 3
    }
  });
});
