import fs from "fs";
import path from "path";

interface TestStep {
  keyword: string;
  text: string;
  line: number;
}

interface StepResult {
  step: TestStep;
  status: string;
  duration: number;
  error?: {
    name: string;
    message: string;
    stack: string;
  };
  embeddings?: {
    data: string;
    mime_type: string;
    name: string;
  }[];
}

interface ScenarioResult {
  scenario: {
    name: string;
    steps: TestStep[];
    tags: string[];
    line: number;
  };
  steps: StepResult[];
  status: string;
  duration: number;
  startTime: string;
  endTime: string;
  videoPath?: string;
  tracePath?: string;
}

interface FeatureResult {
  feature: {
    name: string;
    scenarios: ScenarioResult["scenario"][];
    tags: string[];
    filePath: string;
    background?: {
      steps: TestStep[];
      line: number;
    };
  };
  scenarios: ScenarioResult[];
  status: string;
  duration: number;
}

interface TestReport {
  features: FeatureResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  };
  startTime: string;
  endTime: string;
  baseUrl: string;
  environment: string;
}

function generateHtmlReport(reportPath: string, outputPath: string): void {
  // Read the test report JSON
  const reportData: TestReport = JSON.parse(
    fs.readFileSync(reportPath, "utf-8")
  );

  // Calculate percentages
  const passPercentage = Math.round(
    (reportData.summary.passed / reportData.summary.total) * 100
  );
  const failPercentage = Math.round(
    (reportData.summary.failed / reportData.summary.total) * 100
  );

  // Format duration
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString();
  };

  // Generate screenshot HTML for embeddings
  const generateScreenshotHtml = (
    embeddings: StepResult["embeddings"]
  ): string => {
    // Return empty string if embeddings is null/undefined or empty
    if (!embeddings || embeddings.length === 0) return "";

    // Filter only PNG images
    const screenshots = embeddings.filter(
      (emb) => emb.mime_type === "image/png"
    );
    if (screenshots.length === 0) return "";

    // Generate HTML for each screenshot
    return screenshots
      .map(
        (screenshot, index) => `
    <div class="screenshot-container mt-2 mb-2">
      <div class="d-flex align-items-center gap-2 mb-2">
        <i class="bi bi-camera text-warning"></i>
        <small class="text-muted fw-medium">${screenshot.name}</small>
      </div>
      <div class="screenshot-wrapper">
        <img 
          src="data:${screenshot.mime_type};base64,${screenshot.data}" 
          alt="${screenshot.name}" 
          class="screenshot-thumbnail border rounded shadow-sm" 
          onclick="openScreenshot('data:${screenshot.mime_type};base64,${screenshot.data}', '${screenshot.name}')" 
          title="Click to view full size" 
        />
      </div>
    </div>
    `
      )
      .join("");
  };

  const generateStepHtml = (step: StepResult): string => {
    const statusClass =
      step.status === "passed"
        ? "success"
        : step.status === "failed"
        ? "danger"
        : "secondary";
    const statusIcon =
      step.status === "passed" ? "✔" : step.status === "failed" ? "✗" : "•";

    let errorHtml = "";
    if (step.error) {
      errorHtml = `
        <div class="mt-2 p-3 bg-danger-subtle border border-danger-subtle rounded"> 
            <h6 class="text-danger mb-2">${step.error.name}</h6>
            <pre class="text-danger mb-0" style="font-size: 0.875rem; white-space: pre-wrap;">${step.error.message}</pre> 
        </div> 
        `;
    }

    const screenshotHtml =
      step.status === "failed" ? generateScreenshotHtml(step.embeddings) : "";
    return `
        <div class="step-item border-start border-3 border-${statusClass} ps-3 mb-2">
            <div class="d-flex align-items-center gap-2">
                <span class="badge bg-${statusClass}">${statusIcon}</span>
                <span class="fw-medium">${step.step.keyword}</span>
                <span>${step.step.text}</span>
                <small class="text-muted ms-auto">${step.duration}ms</small>
            </div>
            ${errorHtml}
            ${screenshotHtml}
        </div>
    `;
  };

  //   Generate scenario HTML with collapse functionality
  const generateScenarioHtml = (
    scenario: ScenarioResult,
    featureIndex: number,
    scenarioIndex: number
  ): string => {
    const statusClass =
      scenario.status === "passed"
        ? "success"
        : scenario.status === "failed"
        ? "danger"
        : "secondary";
    const statusIcon =
      scenario.status === "passed"
        ? "✔"
        : scenario.status === "failed"
        ? "✗"
        : "•";
    const scenarioId = `scenario-${featureIndex}-${scenarioIndex}`;
    const collapseId = `collapse-${scenarioId}`;

    const stepsHtml = scenario.steps
      .map((step, stepIndex) => generateStepHtml(step))
      .join("");

    const videoHtml = scenario.videoPath
      ? `
            <div class="mt-2">
                <small class="text-muted">
                    <i class="bi bi-camera-video"></i> Video: ${scenario.videoPath}
                </small>
            </div>
        `
      : "";

    const traceHtml = scenario.tracePath
      ? `
            <div class="mt-2">
                <small class="text-muted">
                    <i class="bi bi-search"></i> 
                    <a href="${scenario.tracePath}" target="_blank" class="text-decoration-none">View Trace</a>
                </small>
            </div>
        `
      : "";

    // Auto-expand failed scenarios
    const shouldExpand = scenario.status === "failed";

    return `
        <div class="scenario-card card mb-3">
            <div class="card-header">
                <div class="d-flex align-items-center justify-content-between">
                    <div class="d-flex align-items-center gap-2">
                        <button
                        class="btn btn-sm btn-outline-secondary border-0 p-1 scenario-toggle"
                        type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="${shouldExpand}" aria-controls="${collapseId}">
                        <i class="bi bi-chevron-${
                          shouldExpand ? "down" : "right"
                        } chevron-icon"></i> 
                        </button>
                        <span class="badge bg-${statusClass} fs-6">${statusIcon}</span> <h6 class="mb-0">${
      scenario.scenario.name
    }</h6>
                    </div>
                    <small class="text-muted">
                        Duration: ${formatDuration(scenario.duration)} |
                        Started At: ${formatTimestamp(scenario.startTime)}
                    </small>
                </div>
            </div>
            <div class="collapse ${
              shouldExpand ? "show" : ""
            }" id="${collapseId}"> 
                <div class="card-body">
                    <div class="steps-container">
                        ${stepsHtml}
                    </div> 
                    ${videoHtml}
                    ${traceHtml}
                </div>
            </div>
        </div>
        `;
  };

  //   Generate feature HTML with collapse functionality
  const generateFeatureHtml = (
    feature: FeatureResult,
    featureIndex: number
  ): string => {
    const statusClass =
      feature.status === "passed"
        ? "success"
        : feature.status === "failed"
        ? "danger"
        : "secondary";
    const featureId = `feature-${featureIndex}`;
    const collapseId = `collapse-${featureId}`;

    const scenariosHtml = feature.scenarios
      .map((scenario, scenarioIndex) =>
        generateScenarioHtml(scenario, featureIndex, scenarioIndex)
      )
      .join("");

    const backgroundHtml = feature.feature.background
      ? `
            <div class="background-steps alert alert-info">
                <h6 class="mb-2"><i class="bi bi-arrow-clockwise"></i> Background Steps</h6>
                ${feature.feature.background.steps
                  .map(
                    (step) => `
                    <div class="d-flex gap-2">
                        <span class="fw-medium">${step.keyword}</span>
                        <span>${step.text}</span>
                    </div>
                    `
                  )
                  .join("")}
            </div>
        `
      : "";

    // Auto-expand failed features
    const shouldExpand = feature.status === "failed";
    return `
        <div class="feature-section mb-4">
            <div class="feature-header p-3 bg-light border rounded-top">
                <div class="d-flex align-items-center justify-content-between">
                    <div class="d-flex align-items-center gap-3">
                        <button
                            class="btn btn-outline-secondary border-0 p-2 feature-toggle" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="${shouldExpand}" aria-controls="${collapseId}">
                            <i class="bi bi-chevron-${
                              shouldExpand ? "down" : "right"
                            } chevron-icon fs-5"></i> 
                        </button> 
                    <div>
                        <h4 class="mb-1 text-${statusClass}">
                            <i class="bi bi-file-earmark-text"></i> ${
                              feature.feature.name
                            } 
                        </h4>
                        <small class="text-muted">${
                          feature.feature.filePath
                        }</small>
                    </div>
                </div>
                <div class="text-end">
                    <div class="badge bg-${statusClass} fs-6 mb-1">
                        ${feature.scenarios.length} scenario(s)
                    </div>
                    <div>
                      <small class="text-muted">Duration: ${formatDuration(
                        feature.duration
                      )}</small>
                    </div>
                </div>
            </div>
            <div class="collapse ${
              shouldExpand ? "show" : ""
            }" id="${collapseId}"> 
                <div class="feature-body border border-top-0 rounded-bottom p-3"> 
                    ${backgroundHtml}
                    ${scenariosHtml}
                </div>
            </div>
        </div>
        `;
  };

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Test Report - ${formatTimestamp(reportData.startTime)}</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
        <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css" rel="stylesheet">
        <style>
            body {
                background-color: #f8f9fa;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }
            .report-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white; 
                padding: 2rem 0;
            }
            .stat-card { 
                border: none; 
                border-radius: 15px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); 
                transition: transform 0.2s;
            }
            .stat-card:hover {
                transform: translateY(-5px);
            }
            .scenario-card { 
                border: none; 
                border-radius: 10px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); 
                transition: box-shadow 0.2s;
            }
            .scenario-card:hover {
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
            }
            .step-item {
                padding: 0.5rem 0;
            }
            .progress-circle { 
                width: 120px;
                height: 120px;
            }
            .feature-header { 
                border-left: 4px solid #667eea !important;
            }
            pre {
                max-height: 200px; 
                overflow-y: auto;
            }
            .feature-toggle, .scenario-toggle { 
                transition: transform 0.2s ease;
            }
            .chevron-icon {
                transition: transform 0.2s ease;
            }
            .screenshot-thumbnail { 
                max-width: 300px; 
                max-height: 200px; 
                cursor: pointer;
                transition: transform 0.2s ease;
            }
            .screenshot-thumbnail:hover { 
                transform: scale(1.05);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            }
            .screenshot-container { 
                background-color: #f8f9fa;
                padding: 10px; 
                border-radius: 8px;
                border: 1px solid #dee2e6;
            }
            .controls-section {
                background: white; 
                padding: 1rem; 
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); 
                margin-bottom: 2rem;
            }
        </style>
    </head>
    <body>
        <div class="report-header">
            <div class="container">
                <div class="row align-items-center">
                    <div class="col-md-8">
                        <h1 class="display-4 fw-bold mb-2">
                            <i class="bi bi-clipboard-check"></i> Test Execution Report
                        </h1>
                        <p class="lead mb-0">
                            Executed on ${formatTimestamp(
                              reportData.startTime
                            )} |
                            Total Duration: ${formatDuration(
                              reportData.summary.duration
                            )}
                        </p>
                    </div>
                    <div class="col-md-4 text-end">
                        <div class="progress-circle bg-white rounded-circle d-flex align-items-center justify-content-center m-auto">
                            <div class="text-center">
                                <div class="fs-2 fw-bold text-${
                                  passPercentage >= 90
                                    ? "success"
                                    : passPercentage >= 85
                                    ? "warning"
                                    : "danger"
                                }">
                                    ${passPercentage}%
                                </div>
                                <small class="text-muted">Success Rate</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="container my-5">
            <!-- Summary Statistics -->
            <div class="row mb-5">
                <div class="col-md-3 mb-3">
                    <div class="card stat-card text-center h-100">
                        <div class="card-body">
                            <i class="bi bi-list-check fs-1 text-primary mb-3"></i>
                            <h3 class="fw-bold text-primary">${
                              reportData.summary.total
                            }</h3>
                            <p class="text-muted mb-0">Total Scenarios</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-3 mb-3"> 
                    <div class="card stat-card text-center h-100">
                        <div class="card-body">
                            <i class="bi bi-check-circle fs-1 text-success mb-3"></i>
                            <h3 class="fw-bold text-success">${
                              reportData.summary.passed
                            }</h3>
                            <p class="text-muted mb-0">Passed (${passPercentage}%)</p>
                        </div>
                    </div>
                </div> 
                <div class="col-md-3 mb-3">
                    <div class="card stat-card text-center h-100"> 
                        <div class="card-body">
                            <i class="bi bi-x-circle fs-1 text-danger mb-3"></i>
                            <h3 class="fw-bold text-danger">${
                              reportData.summary.failed
                            }</h3>
                            <p class="text-muted mb-0">Failed (${failPercentage}%)</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-3 mb-3">
                    <div class="card stat-card text-center h-100">
                        <div class="card-body">
                            <i class="bi bi-clock fs-1 text-info mb-3"></i>
                            <h3 class="fw-bold text-info">${formatDuration(
                              reportData.summary.duration
                            )}</h3>
                        </div>
                        <p class="text-muted mb-0">Total Time</p>
                    </div>
                </div>
            </div>

            <!-- Controls -->
            <div class="controls-section">
                <div class="d-flex gap-2 align-items-center">
                    <button onclick="expandAll()" class="btn btn-outline-primary btn-sm">
                        <i class="bi bi-arrows-expand"></i> Expand All
                    </button>
                    <button onclick="collapseAll()" class="btn btn-outline-secondary btn-sm">
                        <i class="bi bi-arrows-collapse"></i> Collapse All
                    </button>
                    <button onclick="expandFailed()" class="btn btn-outline-danger btn-sm"> 
                        <i class="bi bi-exclamation-triangle"></i> Show Failed Only
                    </button>
                </div>
            </div>

            <!-- Test Results -->
            <div class="row">
                <div class=" col-12">
                    <h2 class=" mb-4">
                        <i class="bi bi-activity"></i> Test Results
                    </h2>
                    ${reportData.features
                      .map((feature, index) =>
                        generateFeatureHtml(feature, index)
                      )
                      .join("")}
                </div>
            </div>

            <!-- Footer -->
            <footer class="text-center mt-5 py-4 border-top">
                <p class="text-muted mb-0">
                    Generated on ${formatTimestamp(new Date().toISOString())} |
                    Team
                </p> 
            </footer>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
        <script>
            // Update chevron icons when collapsing/expanding
            document.addEventListener('show.bs.collapse', function (e) {
                const button = document.querySelector('[data-bs-target="#' + e.target.id + '"]');
                if (button) {
                    const icon = button.querySelector('.chevron-icon');
                    if (icon) {
                        icon.classList.remove('bi-chevron-right'); 
                        icon.classList.add('bi-chevron-down');
                    }
                }
            });

            document.addEventListener('hide.bs.collapse', function (e) {
                const button = document.querySelector('[data-bs-target="#' + e.target.id + '"]');
                if (button) {
                    const icon = button.querySelector('.chevron-icon');
                    if (icon) {
                        icon.classList.remove('bi-chevron-down');
                        icon.classList.add ('bi-chevron-right');
                    }
                }
            });

            // Control functions
            function expandAll() {
                document.querySelectorAll('.collapse').forEach(collapse => {
                    if (!collapse.classList.contains('show')) {
                        const bsCollapse = new bootstrap.Collapse(collapse, { show: true });
                    }
                });
            };

            function collapseAll() {
                document.querySelectorAll('.collapse.show').forEach( collapse => {
                const bsCollapse = new bootstrap.Collapse(collapse, { hide: true });
                });
            }

            function expandFailed() {
                // First collapse all
                collapseAll();
                // Then expand only failed features and scenarios
                setTimeout(()=> {
                    document.querySelectorAll('.feature-section') .forEach( feature => {
                        const failedBadge = feature.querySelector('.bg-danger');
                        if (failedBadge) {
                            const collapse = feature.querySelector('.collapse');
                            if (collapse && !collapse.classList.contains('show')) {
                                const bsCollapse = new bootstrap.Collapse(collapse, { show: true });
                            }

                            // Also expand failed scenarios within this feature
                            setTimeout(()=> {
                                feature.querySelectorAll('.scenario-card').forEach(scenario => {
                                    const scenarioFailedBadge = scenario.querySelector('.bg-danger');
                                    if (scenarioFailedBadge) {
                                        const scenarioCollapse = scenario.querySelector('.collapse');
                                        if (scenarioCollapse && !scenarioCollapse.classList.contains('show')) {
                                            const bsCollapse = new bootstrap.Collapse(scenarioCollapse, { show: true });
                                        }
                                    }
                                });
                            }, 100);
                        }
                    });
                }, 100);
            }
            
            // Screenshot modal functionality
            function openScreenshot(imageSrc, title) {
                document.getElementById('modalImage').src = imageSrc;
                document.getElementById('modalTitle').innerText = title;
                document.getElementById('screenshotModal').style.display = 'block';
            }

            function closeScreenshot() {
                document.getElementById('screenshotModal').style.display = 'none';
            }
            // Auto-refresh every 30 seconds if running (disabled for now)
            // setTimeout(() => {
            // location. reload();
            //}, 30000);
        </script>

        <!-- Screenshot Modal -->
        <div id="screenshotModal" class="modal" onclick="closeScreenshot()" style="display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.8);">
            <div class="modal-content" onclick="event.stopPropagation()" style="background-color: #fefefe; margin: 5% auto; padding: 20px; border: 1px solid #888; width: 90%; max-width: 1200px; border-radius: 8px; position: relative;">
                <button class="close-btn" onclick="closeScreenshot()" style="position: absolute; top: 10px; right: 20px; background: #dc3545; color: white; border: none; padding: 10px 15px; border-radius: 50px; cursor: pointer; font-size: 16px;">x</button>
                <div class="modal-header" style="text-align: center; margin-bottom: 20px;">
                    <h2 id="modalTitle"></h2>
                    
                </div>
                <div class="modal-body" style="text-align: center;">
                    <img id="modalImage" src="" alt="" style="max-width: 100%; height: auto; border-radius: 4px;" />
                </div>
            </div>
        </div>

    </body>
    </html>
    `;

  // Write the HTML file
  fs.writeFileSync(outputPath, html, "utf-8");
  console.log(`HTML report generated: ${outputPath}`);
}

// Main execution
const reportPath = path.join(__dirname, "test-results", "test-report.json");
const outputPath = path.join(__dirname, "test-results", "test-report.html");

generateHtmlReport(reportPath, outputPath);

// interface TestStep {
//   keyword: string;
//   text: string;
//   line: number;
// }
// interface StepResult {
//   step: TestStep;
//   status: string;
//   duration: number;
//   error?: {
//     name: string;
//     message: string;
//     stack: string;
//   };
//   embeddings?: {
//     data: string;
//     mime_type: string;
//     name: string;
//   }[];
// }

// interface ScenarioResult {
//   scenario: {
//     name: string;
//     steps: TestStep[];
//     tags: string[];
//     line: number;
//   };
//   steps: StepResult[];
//   status: string;
//   duration: number;
//   startTime: string;
//   endTime: string;
//   videoPath?: string;
// }

// interface FeatureResult {
//   feature: {
//     name: string;
//     scenarios: any[];
//     tags: string[];
//     filePath: string;
//     background?: {
//       steps: TestStep[];
//       line: number;
//     };
//   };
//   scenarios: ScenarioResult[];
//   status: string;
//   duration: number;
// }

// interface TestReport {
//   features: FeatureResult[];
//   summary: {
//     total: number;
//     passed: number;
//     failed: number;
//     skipped: number;
//     duration: number;
//   };
//   startTime: string;
//   endTime: string;
// }
