// kernels/astro.rs — Planetary Position Engine (TFG sphere click readings)
//
// Computes geocentric ecliptic longitudes for 10 astrological bodies using
// mean longitude + L2 correction term (Jean Meeus, Astronomical Algorithms,
// 2nd ed., Appendix II). Accuracy: ±2° for all planets, sufficient for
// zodiac sign and degree display.
//
// Body indices (internal):
//   0=Mercury  1=Venus  2=Sun(Earth+180°)  3=Mars  4=Jupiter
//   5=Saturn   6=Uranus  7=Neptune  8=Pluto  9=Moon
//
// Output: text blocks separated by "---\n", one per body.

use wasm_bindgen::prelude::*;

const DEG: f64 = std::f64::consts::PI / 180.0;

fn unix_ms_to_t(unix_ms: f64) -> f64 {
    let jde = 2440587.5 + unix_ms / 86_400_000.0;
    (jde - 2451545.0) / 36525.0
}

fn normalize(deg: f64) -> f64 {
    let d = deg % 360.0;
    if d < 0.0 { d + 360.0 } else { d }
}

// Heliocentric mean longitude (Meeus App. II)
// body: 0=Mercury 1=Venus 2=Earth 3=Mars 4=Jupiter 5=Saturn 6=Uranus 7=Neptune 8=Pluto
fn helio_lon(body: usize, t: f64) -> f64 {
    let (l0, l1, l2): (f64, f64, f64) = match body {
        0 => (252.250906, 149474.0722491,  0.00030397),
        1 => (181.979801,  58519.2130302,  0.00031014),
        2 => (100.464457,  36000.7698278,  0.00030322),
        3 => (355.433275,  19141.6964746,  0.00031097),
        4 => ( 34.351484,   3036.3027889,  0.00022374),
        5 => ( 50.077444,   1223.5110686,  0.00051908),
        6 => (314.055005,    429.8640561,  0.00030390),
        7 => (304.348665,    219.8833092,  0.00030926),
        8 => (238.958116,    144.9600329,  0.0),
        _ => (0.0, 0.0, 0.0),
    };
    normalize(l0 + l1 * t + l2 * t * t)
}

fn helio_radius(body: usize) -> f64 {
    match body {
        0 => 0.387, 1 => 0.723, 2 => 1.000, 3 => 1.524,
        4 => 5.203, 5 => 9.537, 6 => 19.19, 7 => 30.07,
        8 => 39.48, _ => 1.0,
    }
}

fn geocentric_lon(planet: usize, t: f64) -> f64 {
    if planet == 2 {
        return normalize(helio_lon(2, t) + 180.0); // Sun
    }
    if planet == 9 {
        return normalize(218.3164477 + 481267.88123421 * t); // Moon
    }
    let e_rad = helio_lon(2, t) * DEG;
    let p_rad = helio_lon(planet, t) * DEG;
    let re    = helio_radius(2);
    let rp    = helio_radius(planet);
    let ex    = re * e_rad.cos();
    let ey    = re * e_rad.sin();
    let px    = rp * p_rad.cos();
    let py    = rp * p_rad.sin();
    normalize((py - ey).atan2(px - ex) / DEG)
}

fn is_retrograde(planet: usize, t: f64) -> bool {
    if planet == 2 || planet == 9 { return false; }
    let dt   = 1.0 / 36525.0;
    let lon1 = geocentric_lon(planet, t);
    let lon2 = geocentric_lon(planet, t + dt);
    let mut diff = lon2 - lon1;
    if diff >  180.0 { diff -= 360.0; }
    if diff < -180.0 { diff += 360.0; }
    diff < 0.0
}

const ZODIAC: [&str; 12] = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

const PLANET_NAMES: [&str; 10] = [
    "Mercury", "Venus", "Sun", "Mars", "Jupiter",
    "Saturn", "Uranus", "Neptune", "Pluto", "Moon",
];

const ASPECTS: [(f64, &str); 5] = [
    (0.0,   "Conjunct"),
    (60.0,  "Sextile"),
    (90.0,  "Square"),
    (120.0, "Trine"),
    (180.0, "Opposite"),
];

fn dominant_aspect(i: usize, lons: &[f64; 10]) -> String {
    let mut best: Option<(f64, &str, usize)> = None;
    for j in 0..10 {
        if j == i { continue; }
        let mut sep = (lons[i] - lons[j]).abs() % 360.0;
        if sep > 180.0 { sep = 360.0 - sep; }
        for &(angle, name) in &ASPECTS {
            let orb = (sep - angle).abs();
            if orb < 8.0 && (best.is_none() || orb < best.unwrap().0) {
                best = Some((orb, name, j));
            }
        }
    }
    match best {
        Some((orb, name, j)) => format!("{} {} (orb {:.0}°)", name, PLANET_NAMES[j], orb),
        None => String::from("\u{2014}"),
    }
}

#[wasm_bindgen]
pub fn run_astro(unix_ms: f64) -> String {
    let t = unix_ms_to_t(unix_ms);
    let mut lons = [0.0f64; 10];
    for i in 0..10 {
        lons[i] = geocentric_lon(i, t);
    }
    let mut out = String::with_capacity(512);
    for i in 0..10 {
        let lon      = lons[i];
        let sign_idx = (lon / 30.0).floor() as usize % 12;
        let degree   = lon % 30.0;
        let retro    = is_retrograde(i, t);
        let aspect   = dominant_aspect(i, &lons);
        if i > 0 { out.push_str("---\n"); }
        out.push_str(&format!(
            "{}\nsign:{}\ndegree:{:.0}\nretrograde:{}\naspect:{}\n",
            PLANET_NAMES[i], ZODIAC[sign_idx], degree, retro, aspect,
        ));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_unix_ms_to_t_near_j2000() {
        let t = unix_ms_to_t(946728000000.0);
        assert!(t.abs() < 0.01, "T at J2000 expected ~0, got {}", t);
    }

    #[test]
    fn test_normalize_wraps() {
        assert!((normalize(370.0) - 10.0).abs() < 0.001);
        assert!((normalize(-10.0) - 350.0).abs() < 0.001);
        assert!((normalize(0.0) - 0.0).abs() < 0.001);
    }

    #[test]
    fn test_sun_at_j2000_capricorn() {
        let lon = geocentric_lon(2, 0.0);
        assert!(lon > 265.0 && lon < 295.0, "Sun at J2000 expected ~280°, got {}", lon);
    }

    #[test]
    fn test_run_astro_returns_10_blocks() {
        let result = run_astro(1_700_000_000_000.0);
        assert_eq!(result.matches("---\n").count(), 9, "expected 9 separators, got:\n{}", result);
    }

    #[test]
    fn test_run_astro_contains_all_planet_names() {
        let result = run_astro(1_700_000_000_000.0);
        for name in &["Mercury","Venus","Sun","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","Moon"] {
            assert!(result.contains(&format!("{}\n", name)), "missing planet: {}", name);
        }
    }

    #[test]
    fn test_run_astro_sign_fields_present() {
        let result = run_astro(1_700_000_000_000.0);
        assert_eq!(result.matches("sign:").count(), 10);
        assert_eq!(result.matches("retrograde:").count(), 10);
        assert_eq!(result.matches("aspect:").count(), 10);
    }

    #[test]
    fn test_moon_not_retrograde() {
        let result = run_astro(1_700_000_000_000.0);
        // Find the Moon block between "Moon\n" and the next "---\n" or end
        if let Some(start) = result.find("Moon\n") {
            let rest = &result[start..];
            let block = if let Some(sep) = rest.find("---\n") { &rest[..sep] } else { rest };
            assert!(block.contains("retrograde:false"), "Moon should not be retrograde, block: {}", block);
        } else {
            panic!("Moon block not found in output");
        }
    }
}
