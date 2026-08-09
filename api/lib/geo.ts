// Farm-boundary area from a traced lat/lng polygon (tap-corners or GPS
// walk). Farm plots are small (a few hectares at most), so a flat
// equirectangular projection centered on the shape is accurate enough —
// no need for a full geodesic area formula at this scale.
const EARTH_RADIUS_M = 6371000;
const SQM_PER_ACRE = 4046.8564224;

export function polygonAcres(points: { lat: number; lng: number }[]): number {
  if (points.length < 3) return 0;

  const lat0 = (points.reduce((s, p) => s + p.lat, 0) / points.length) * (Math.PI / 180);
  const toXY = (p: { lat: number; lng: number }) => ({
    x: p.lng * (Math.PI / 180) * EARTH_RADIUS_M * Math.cos(lat0),
    y: p.lat * (Math.PI / 180) * EARTH_RADIUS_M,
  });
  const xy = points.map(toXY);

  let area2 = 0;
  for (let i = 0; i < xy.length; i++) {
    const a = xy[i];
    const b = xy[(i + 1) % xy.length];
    area2 += a.x * b.y - b.x * a.y;
  }
  const areaM2 = Math.abs(area2) / 2;
  return Math.round((areaM2 / SQM_PER_ACRE) * 100) / 100;
}
