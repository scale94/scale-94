// useSpectralLight.js — Real-time PCA-driven spectral coloring for Hopfield sphere
//
// Performs eigendecomposition of the activation-weighted covariance matrix
// over the 16D feature space. Maps the resulting eigenspectrum to visible
// light wavelengths (380nm violet through 780nm red) so the sphere's color
// reflects the dimensionality of its current attractor basin.
//
// Mathematical foundations:
//   PCA / Karhunen-Loeve:  K. Karhunen, "Zur Spektraltheorie stochastischer
//                          Prozesse" (1946); M. Loeve (1955)
//   Jacobi eigenvalues:    C.G.J. Jacobi, "Uber ein leichtes Verfahren, die in
//                          der Theorie der Sacularstorungen vorkommenden
//                          Gleichungen numerisch aufzulosen" (1846)
//   Participation ratio:   R.J. Bell & P. Dean, "Atomic vibrations in vitreous
//                          silica" (1970) — PR = (Sum lambda_i)^2 / Sum(lambda_i^2)
//   CIE color matching:    CIE 1931 2-degree standard observer (approximate
//                          piecewise-linear RGB conversion after Dan Bruton)
//
// Ars Electronica 2027 — scale 9.4

import { useRef, useCallback } from 'react';
import { FEATURES, DIM_NAMES } from '../data/nodeFeatures';

// ── Constants ────────────────────────────────────────────────────────────────

const D = 16;                    // feature dimensionality (|DIM_NAMES|)
const MAX_NODES = 64;            // upper bound on active nodes
const PCA_INTERVAL = 8;          // recompute eigendecomposition every N frames
const JACOBI_MAX_SWEEPS = 50;    // hard cap on Jacobi iteration sweeps
const JACOBI_TOL = 1e-10;        // off-diagonal convergence threshold
const TOP_K = 4;                 // number of principal components to expose
const FLUX_SMOOTHING = 0.85;     // exponential smoothing factor for spectral flux

// Visible spectrum bounds (nanometers)
const LAMBDA_MIN = 380;          // violet edge
const LAMBDA_MAX = 780;          // red edge

// ── Pre-allocated working arrays (module-level, zero-copy reuse) ─────────

// Covariance matrix (D x D symmetric, stored flat row-major)
const _cov = new Float64Array(D * D);

// Jacobi workspace: matrix A (destroyed during iteration) and eigenvector matrix V
const _A = new Float64Array(D * D);
const _V = new Float64Array(D * D);

// Eigenvalues (unsorted workspace, then sorted output)
const _eigenvalues = new Float64Array(D);
const _sortedEigenvalues = new Float64Array(D);

// Eigenvectors: columns of V reordered by descending eigenvalue
// Stored as TOP_K vectors of length D for the exposed interface
const _topVectors = Array.from({ length: TOP_K }, () => new Float64Array(D));

// Previous eigenvalue snapshot for flux computation
const _prevEigenvalues = new Float64Array(D);

// Per-node color cache: [r, g, b, a] for each node
const _nodeColors = Array.from({ length: MAX_NODES }, () => new Float32Array(4));
const _nodeColorValid = new Uint8Array(MAX_NODES);

// Weighted mean feature vector (scratch)
const _meanVec = new Float64Array(D);

// Ambient color output
const _ambientColor = new Float32Array(4);

// Sort index permutation
const _sortPerm = new Uint32Array(D);

// ── Jacobi Eigenvalue Algorithm ──────────────────────────────────────────────
//
// Finds all eigenvalues and eigenvectors of a real symmetric D x D matrix.
//
// The classical Jacobi method applies a sequence of Givens rotations to
// annihilate the largest off-diagonal element at each step. For a 16x16
// matrix, convergence is typically achieved in 5-8 sweeps (each sweep
// visits all D*(D-1)/2 off-diagonal pairs).
//
// Input:  _A (D x D, row-major, symmetric) — DESTROYED in place
// Output: _eigenvalues[0..D-1], _V (D x D column-major eigenvectors)
//
// Complexity: O(D^3) per sweep, O(D^3 * sweeps) total ~ 4096 * 7 ~ 28672 ops

function jacobiEigen() {
  const n = D;

  // Initialize V = Identity (eigenvectors start as coordinate axes)
  _V.fill(0);
  for (let i = 0; i < n; i++) _V[i * n + i] = 1.0;

  for (let sweep = 0; sweep < JACOBI_MAX_SWEEPS; sweep++) {
    // Compute off-diagonal Frobenius norm: ||off(A)||_F
    let offNorm = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        offNorm += _A[i * n + j] * _A[i * n + j];
      }
    }
    offNorm = Math.sqrt(2 * offNorm); // factor 2 for symmetry

    // Convergence check: off-diagonal elements negligible
    if (offNorm < JACOBI_TOL) break;

    // Sweep through all upper-triangular pairs (i, j), i < j
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        const Apq = _A[p * n + q];

        // Skip near-zero off-diagonal elements
        if (Math.abs(Apq) < 1e-15) continue;

        // Compute the Jacobi rotation angle theta such that:
        //   tan(2*theta) = 2*A[p][q] / (A[p][p] - A[q][q])
        //
        // We use the stable formulation via t = sgn(tau) / (|tau| + sqrt(1 + tau^2))
        // where tau = (A[q][q] - A[p][p]) / (2 * A[p][q])
        const tau = (_A[q * n + q] - _A[p * n + p]) / (2.0 * Apq);
        const t = (tau >= 0 ? 1 : -1) / (Math.abs(tau) + Math.sqrt(1.0 + tau * tau));
        const c = 1.0 / Math.sqrt(1.0 + t * t);  // cos(theta)
        const s = t * c;                            // sin(theta)

        // Apply the Givens rotation to A:
        //   A' = G^T * A * G
        // where G is identity except G[p][p]=c, G[q][q]=c, G[p][q]=s, G[q][p]=-s

        // Update diagonal elements
        const App = _A[p * n + p];
        const Aqq = _A[q * n + q];
        _A[p * n + p] = c * c * App - 2 * s * c * Apq + s * s * Aqq;
        _A[q * n + q] = s * s * App + 2 * s * c * Apq + c * c * Aqq;

        // Zero out the (p,q) and (q,p) entries (this is the point of the rotation)
        _A[p * n + q] = 0;
        _A[q * n + p] = 0;

        // Update off-diagonal rows/columns affected by the rotation
        for (let r = 0; r < n; r++) {
          if (r === p || r === q) continue;

          const Arp = _A[r * n + p];
          const Arq = _A[r * n + q];
          _A[r * n + p] = c * Arp - s * Arq;
          _A[p * n + r] = _A[r * n + p]; // symmetry
          _A[r * n + q] = s * Arp + c * Arq;
          _A[q * n + r] = _A[r * n + q]; // symmetry
        }

        // Accumulate eigenvectors: V' = V * G
        for (let r = 0; r < n; r++) {
          const Vrp = _V[r * n + p];
          const Vrq = _V[r * n + q];
          _V[r * n + p] = c * Vrp - s * Vrq;
          _V[r * n + q] = s * Vrp + c * Vrq;
        }
      }
    }
  }

  // Extract eigenvalues from the diagonalized matrix
  for (let i = 0; i < n; i++) {
    _eigenvalues[i] = _A[i * n + i];
  }
}


// ── Activation-Weighted Covariance Matrix ────────────────────────────────────
//
// Given N active nodes with Hopfield activations a_i in [0,1] and 16D feature
// vectors f_i, compute the weighted covariance:
//
//   mu = (Sum a_i * f_i) / (Sum a_i)
//   C[j][k] = Sum_i a_i * (f_i[j] - mu[j]) * (f_i[k] - mu[k])
//
// This yields a 16x16 positive semi-definite symmetric matrix whose
// eigenspectrum reveals which dimensions of feature space are most active
// in the current Hopfield attractor basin.

function computeWeightedCovariance(activations, features, nodeCount) {
  const n = Math.min(nodeCount, MAX_NODES);

  // Compute total activation weight
  let totalWeight = 0;
  for (let i = 0; i < n; i++) {
    totalWeight += activations[i];
  }

  // Guard against zero-weight degenerate case
  if (totalWeight < 1e-12) {
    _cov.fill(0);
    // Return identity-like covariance to avoid singular PCA
    for (let d = 0; d < D; d++) _cov[d * D + d] = 1e-6;
    return;
  }

  const invWeight = 1.0 / totalWeight;

  // Weighted mean: mu[j] = Sum_i(a_i * f_i[j]) / Sum_i(a_i)
  _meanVec.fill(0);
  for (let i = 0; i < n; i++) {
    const a = activations[i];
    const f = features[i];
    for (let j = 0; j < D; j++) {
      _meanVec[j] += a * f[j];
    }
  }
  for (let j = 0; j < D; j++) {
    _meanVec[j] *= invWeight;
  }

  // Weighted covariance: C[j][k] = Sum_i a_i * (f_i[j] - mu[j]) * (f_i[k] - mu[k])
  // The matrix is symmetric, so we compute upper triangle and mirror.
  _cov.fill(0);
  for (let i = 0; i < n; i++) {
    const a = activations[i];
    const f = features[i];
    for (let j = 0; j < D; j++) {
      const dj = f[j] - _meanVec[j];
      for (let k = j; k < D; k++) {
        _cov[j * D + k] += a * dj * (f[k] - _meanVec[k]);
      }
    }
  }

  // Mirror lower triangle
  for (let j = 0; j < D; j++) {
    for (let k = j + 1; k < D; k++) {
      _cov[k * D + j] = _cov[j * D + k];
    }
  }
}


// ── Sort Eigenvalues Descending ──────────────────────────────────────────────
//
// Builds a permutation index, sorts by descending eigenvalue, and reorders
// both eigenvalues and eigenvector columns accordingly.

function sortEigenDescending() {
  // Initialize permutation
  for (let i = 0; i < D; i++) _sortPerm[i] = i;

  // Insertion sort on _eigenvalues (D=16, so O(D^2)=256 ops — trivial)
  for (let i = 1; i < D; i++) {
    const key = _eigenvalues[i];
    const keyIdx = _sortPerm[i];
    let j = i - 1;
    while (j >= 0 && _eigenvalues[j] < key) {
      _eigenvalues[j + 1] = _eigenvalues[j];
      _sortPerm[j + 1] = _sortPerm[j];
      j--;
    }
    _eigenvalues[j + 1] = key;
    _sortPerm[j + 1] = keyIdx;
  }

  // Copy sorted eigenvalues
  _sortedEigenvalues.set(_eigenvalues);

  // Extract top-K eigenvectors in sorted order
  // V is row-major: V[r * D + col] = component r of eigenvector col
  for (let k = 0; k < TOP_K && k < D; k++) {
    const col = _sortPerm[k];
    for (let r = 0; r < D; r++) {
      _topVectors[k][r] = _V[r * D + col];
    }
  }
}


// ── CIE-Approximate Wavelength to RGB ────────────────────────────────────────
//
// Attempt to convert a wavelength in nanometers to an RGB triple using the
// standard piecewise-linear approximation (after Dan Bruton, 1996).
//
// The visible spectrum is divided into six bands with linear interpolation
// of the R, G, B channels. Intensity attenuation is applied at the UV and
// IR edges (380-420nm and 700-780nm) where the human eye's sensitivity
// drops off.
//
// Returns [r, g, b] each in [0, 1].

function wavelengthToRGB(lambda) {
  let r = 0, g = 0, b = 0;

  if (lambda >= 380 && lambda < 440) {
    // 380-440nm: violet to blue (red component decreasing linearly)
    r = -(lambda - 440) / (440 - 380);
    g = 0;
    b = 1;
  } else if (lambda >= 440 && lambda < 490) {
    // 440-490nm: blue to cyan (green rising)
    r = 0;
    g = (lambda - 440) / (490 - 440);
    b = 1;
  } else if (lambda >= 490 && lambda < 510) {
    // 490-510nm: cyan to green (blue falling)
    r = 0;
    g = 1;
    b = -(lambda - 510) / (510 - 490);
  } else if (lambda >= 510 && lambda < 580) {
    // 510-580nm: green to yellow (red rising)
    r = (lambda - 510) / (580 - 510);
    g = 1;
    b = 0;
  } else if (lambda >= 580 && lambda < 645) {
    // 580-645nm: yellow to red (green falling)
    r = 1;
    g = -(lambda - 645) / (645 - 580);
    b = 0;
  } else if (lambda >= 645 && lambda <= 780) {
    // 645-780nm: red
    r = 1;
    g = 0;
    b = 0;
  }

  // Intensity attenuation at spectrum edges
  // Human scotopic/photopic sensitivity drops at UV and IR boundaries
  let intensity = 1.0;
  if (lambda >= 380 && lambda < 420) {
    // UV edge: linear ramp from 0.3 at 380nm to 1.0 at 420nm
    intensity = 0.3 + 0.7 * (lambda - 380) / (420 - 380);
  } else if (lambda > 700 && lambda <= 780) {
    // IR edge: linear ramp from 1.0 at 700nm to 0.3 at 780nm
    intensity = 0.3 + 0.7 * (780 - lambda) / (780 - 700);
  }

  return [r * intensity, g * intensity, b * intensity];
}


// ── Eigenvalue to Wavelength Mapping ─────────────────────────────────────────
//
// Maps the i-th sorted eigenvalue to a visible wavelength. The mapping
// distributes principal components across the spectrum:
//
//   PC0 (most variance) -> 620nm (red-orange)   — dominant structure
//   PC1                 -> 540nm (green)         — secondary structure
//   PC2                 -> 470nm (blue)          — tertiary
//   PC3                 -> 410nm (violet)        — quaternary
//   ...
//   PC15                -> 380nm (deep violet)   — noise floor
//
// This creates a perceptually natural color language:
//   - A one-dimensional attractor (single large eigenvalue) glows warm red
//   - A two-dimensional attractor adds green, creating amber/gold
//   - Full-dimensional states shimmer across the entire spectrum

function eigenIndexToWavelength(index) {
  // Map index 0..D-1 to wavelength LAMBDA_MAX..LAMBDA_MIN
  // Index 0 (dominant) -> red end, index D-1 (weakest) -> violet end
  const t = index / (D - 1);
  return LAMBDA_MAX - t * (LAMBDA_MAX - LAMBDA_MIN);
}


// ── Participation Ratio ──────────────────────────────────────────────────────
//
// PR = (Sum lambda_i)^2 / Sum(lambda_i^2)
//
// This is the inverse Herfindahl index of the eigenvalue distribution.
// It measures the "effective number of dimensions" of the current state:
//
//   - If one eigenvalue dominates: PR ~ 1 (monochromatic attractor)
//   - If all eigenvalues are equal: PR = D = 16 (isotropic, high-dimensional)
//   - Intermediate values indicate the attractor's effective dimensionality
//
// Range: [1, D] for non-negative eigenvalues with at least one nonzero.

function computeParticipationRatio(eigenvalues) {
  let sumLambda = 0;
  let sumLambdaSq = 0;

  for (let i = 0; i < D; i++) {
    // Clamp negative eigenvalues to zero (numerical noise from Jacobi)
    const lam = Math.max(0, eigenvalues[i]);
    sumLambda += lam;
    sumLambdaSq += lam * lam;
  }

  if (sumLambdaSq < 1e-20) return 1.0;
  return (sumLambda * sumLambda) / sumLambdaSq;
}


// ── Spectral Flux ────────────────────────────────────────────────────────────
//
// L2 distance between consecutive eigenvalue vectors, normalized to [0, 1].
// Measures how fast the attractor's spectral signature is changing.
//
//   flux_raw = ||lambda_t - lambda_{t-1}||_2
//   flux = EMA(flux_raw / max_scale, alpha)
//
// High flux => visual turbulence (rapid color shifts)
// Low flux  => visual stability (steady coloring)

function computeSpectralFlux(currentEigen, prevEigen) {
  let sumSq = 0;
  for (let i = 0; i < D; i++) {
    const diff = currentEigen[i] - prevEigen[i];
    sumSq += diff * diff;
  }
  return Math.sqrt(sumSq);
}


// ── Node Color Computation ───────────────────────────────────────────────────
//
// Each node's color is determined by its projection onto the principal
// components. The i-th PC maps to the i-th wavelength band:
//
//   projection_k = dot(f_node - mu, eigenvector_k) for k in [0, TOP_K)
//
// Node color = Sum_k |projection_k| * wavelengthToRGB(lambda_k) * eigenIntensity_k
//
// The eigenvalue magnitude modulates the intensity of each spectral band,
// so dimensions with more variance produce brighter color contributions.

function computeNodeColor(nodeIndex, features, nodeCount, eigenvalues, outColor) {
  const f = features[nodeIndex];
  if (!f) {
    outColor[0] = 0.5; outColor[1] = 0.5; outColor[2] = 0.5; outColor[3] = 1;
    return;
  }

  let rAcc = 0, gAcc = 0, bAcc = 0;
  let totalWeight = 0;

  // Total eigenvalue sum for normalizing intensities
  let eigenSum = 0;
  for (let k = 0; k < TOP_K; k++) {
    eigenSum += Math.max(0, eigenvalues[k]);
  }
  if (eigenSum < 1e-12) eigenSum = 1;

  for (let k = 0; k < TOP_K; k++) {
    const eigVal = Math.max(0, eigenvalues[k]);

    // Project the node's (centered) feature vector onto the k-th eigenvector
    let projection = 0;
    for (let d = 0; d < D; d++) {
      projection += (f[d] - _meanVec[d]) * _topVectors[k][d];
    }

    // Intensity = |projection| * (eigenvalue / total) — larger PCs contribute more
    const intensity = Math.abs(projection) * (eigVal / eigenSum);

    // Map this PC to a visible wavelength
    const lambda = eigenIndexToWavelength(k);
    const [r, g, b] = wavelengthToRGB(lambda);

    rAcc += r * intensity;
    gAcc += g * intensity;
    bAcc += b * intensity;
    totalWeight += intensity;
  }

  // Normalize to [0, 1] range
  if (totalWeight > 1e-12) {
    outColor[0] = Math.min(1, rAcc / totalWeight);
    outColor[1] = Math.min(1, gAcc / totalWeight);
    outColor[2] = Math.min(1, bAcc / totalWeight);
  } else {
    outColor[0] = 0.5; outColor[1] = 0.5; outColor[2] = 0.5;
  }
  outColor[3] = 1.0;
}


// ── Ambient Color ────────────────────────────────────────────────────────────
//
// A single color representing the sphere's global spectral state.
// Driven by the participation ratio:
//
//   Low PR (1-2):   saturated monochromatic hue from the dominant PC's wavelength
//   Medium PR (3-5): dichromatic/trichromatic blend
//   High PR (8+):    desaturated white-ish (high-dimensional, complex attractor)
//
// This ambient color feeds into: background glow, vignette tint, bloom pass.

function computeAmbientColor(eigenvalues, participationRatio) {
  let rAcc = 0, gAcc = 0, bAcc = 0;
  let totalWeight = 0;

  for (let k = 0; k < D; k++) {
    const eigVal = Math.max(0, eigenvalues[k]);
    if (eigVal < 1e-12) continue;

    const lambda = eigenIndexToWavelength(k);
    const [r, g, b] = wavelengthToRGB(lambda);

    rAcc += r * eigVal;
    gAcc += g * eigVal;
    bAcc += b * eigVal;
    totalWeight += eigVal;
  }

  if (totalWeight > 1e-12) {
    rAcc /= totalWeight;
    gAcc /= totalWeight;
    bAcc /= totalWeight;
  }

  // Desaturation based on participation ratio
  // PR in [1, D] -> desaturation in [0, 1]
  // Low PR (pure attractor) -> fully saturated
  // High PR (isotropic) -> washed out toward white
  const desatT = Math.min(1, Math.max(0, (participationRatio - 1) / (D * 0.5 - 1)));
  const luminance = 0.2126 * rAcc + 0.7152 * gAcc + 0.0722 * bAcc;

  _ambientColor[0] = rAcc + desatT * (luminance - rAcc);
  _ambientColor[1] = gAcc + desatT * (luminance - gAcc);
  _ambientColor[2] = bAcc + desatT * (luminance - bAcc);

  // Alpha encodes the dominant eigenvalue's fractional share (useful for bloom)
  const maxEig = Math.max(0, eigenvalues[0]);
  _ambientColor[3] = totalWeight > 1e-12 ? maxEig / totalWeight : 0;
}


// ── Hook ─────────────────────────────────────────────────────────────────────

export function useSpectralLight({ fieldRef, features, nodeCount }) {
  // fieldRef: ref from useAssociativeField (contains .activations Float64Array)
  // features: the 16D feature matrix (array of arrays or Float32Arrays)
  // nodeCount: current number of active nodes (may change with morphogenesis)

  const spectralRef = useRef({
    frameCounter: 0,
    participationRatio: 1,
    spectralFlux: 0,
    smoothedFlux: 0,
    eigenvalues: new Float64Array(D),
    initialized: false,
  });

  // ── stepSpectral: call every RAF frame ─────────────────────────────────
  // Internally gates PCA recomputation to every PCA_INTERVAL frames.
  // Frame-skipping keeps the O(D^3) Jacobi cost off the hot path.

  const stepSpectral = useCallback(() => {
    const state = spectralRef.current;
    state.frameCounter++;

    // Only recompute PCA every PCA_INTERVAL frames
    if (state.frameCounter % PCA_INTERVAL !== 0) return;

    const field = fieldRef.current;
    if (!field || !field.activations) return;

    const n = Math.min(nodeCount, MAX_NODES, features.length);
    if (n < 1) return;

    // Snapshot previous eigenvalues for flux computation
    _prevEigenvalues.set(state.eigenvalues);

    // ── Step 1: Build activation-weighted covariance matrix ──────────
    computeWeightedCovariance(field.activations, features, n);

    // ── Step 2: Copy covariance into Jacobi workspace ────────────────
    // _A is destroyed during Jacobi iteration; _cov is preserved
    _A.set(_cov);

    // ── Step 3: Jacobi eigendecomposition ────────────────────────────
    jacobiEigen();

    // ── Step 4: Sort eigenvalues descending, extract top eigenvectors
    sortEigenDescending();

    // ── Step 5: Participation ratio ──────────────────────────────────
    state.participationRatio = computeParticipationRatio(_sortedEigenvalues);

    // ── Step 6: Store sorted eigenvalues ─────────────────────────────
    state.eigenvalues.set(_sortedEigenvalues);

    // ── Step 7: Spectral flux (L2 eigenvalue distance) ───────────────
    if (state.initialized) {
      const rawFlux = computeSpectralFlux(_sortedEigenvalues, _prevEigenvalues);
      // Normalize raw flux: typical eigenvalue magnitudes are O(1),
      // so sqrt(D) ~ 4 is a reasonable max-scale reference
      const normalizedFlux = Math.min(1, rawFlux / Math.sqrt(D));
      // Exponential moving average for visual smoothness
      state.smoothedFlux = FLUX_SMOOTHING * state.smoothedFlux
                         + (1 - FLUX_SMOOTHING) * normalizedFlux;
      state.spectralFlux = state.smoothedFlux;
    } else {
      state.initialized = true;
      state.spectralFlux = 0;
    }

    // ── Step 8: Ambient color ────────────────────────────────────────
    computeAmbientColor(_sortedEigenvalues, state.participationRatio);

    // ── Step 9: Invalidate node color cache ──────────────────────────
    _nodeColorValid.fill(0);
  }, [fieldRef, features, nodeCount]);

  // ── getNodeColor: lazily computed per-node color ───────────────────────
  // Returns an [r, g, b, a] Float32Array (values in [0, 1]).
  // Caches results and only recomputes after PCA invalidation.

  const getNodeColor = useCallback((nodeIndex) => {
    if (nodeIndex < 0 || nodeIndex >= MAX_NODES) return _nodeColors[0];

    if (!_nodeColorValid[nodeIndex]) {
      computeNodeColor(
        nodeIndex, features, nodeCount,
        spectralRef.current.eigenvalues, _nodeColors[nodeIndex]
      );
      _nodeColorValid[nodeIndex] = 1;
    }

    return _nodeColors[nodeIndex];
  }, [features, nodeCount]);

  // ── getAmbientColor: global sphere tint ────────────────────────────────

  const getAmbientColor = useCallback(() => {
    return _ambientColor;
  }, []);

  // ── getParticipationRatio: effective dimensionality ────────────────────

  const getParticipationRatio = useCallback(() => {
    return spectralRef.current.participationRatio;
  }, []);

  // ── getEigenspectrum: sorted eigenvalues ───────────────────────────────

  const getEigenspectrum = useCallback(() => {
    return spectralRef.current.eigenvalues;
  }, []);

  // ── getSpectralFlux: 0-1 rate of spectral change ──────────────────────

  const getSpectralFlux = useCallback(() => {
    return spectralRef.current.spectralFlux;
  }, []);

  // ── getPCDirections: top-K eigenvectors (each 16D) ─────────────────────

  const getPCDirections = useCallback(() => {
    return _topVectors;
  }, []);

  return {
    spectralRef,
    stepSpectral,
    getNodeColor,
    getAmbientColor,
    getParticipationRatio,
    getEigenspectrum,
    getSpectralFlux,
    getPCDirections,
  };
}
