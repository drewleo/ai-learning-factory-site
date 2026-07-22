// PM AI Adoption Kit builder — resolves tokens from URL query params (falling back to the
// default Mara Ellis / Meridian Group example), renders the templated kit files client-side,
// and packages everything into a downloadable zip. No backend involved.

const KIT_TEMPLATE_DIR = 'assets/kit-templates/project-manager-kit/';
const KIT_FILES = [
  'index.html',
  'module-1-agent.html',
  'module-2-planner.html',
  'module-3-dashboards.html',
  'module-4-personal-agent.html',
  'prompt-library.html',
];
const DECK_FILE = 'PM-AI-Adoption-Kit.pptx';

const DEFAULTS = {
  personaFull: 'Mara Ellis',
  companyName: 'Meridian Group',
  projectName: 'Project Atlas',
  useCaseBlurb:
    "a 90-day initiative to roll out a new client-onboarding platform across Sales, Ops, " +
    "and Support. Three workstreams, ~25 people, a steering committee that wants a weekly " +
    "status update, and a go-live date that isn't moving",
};

function resolveTokens() {
  const params = new URLSearchParams(window.location.search);
  const personaFull = params.get('persona') || DEFAULTS.personaFull;
  const companyName = params.get('company') || DEFAULTS.companyName;
  const projectName = params.get('project') || DEFAULTS.projectName;
  const useCaseBlurb = params.get('usecase') || DEFAULTS.useCaseBlurb;
  const agentName = params.get('agent') || `${projectName} Copilot`;
  const personaFirst = personaFull.split(' ')[0];
  const isCustomized = params.has('company') || params.has('persona') || params.has('project') || params.has('usecase');
  const kitTitle = isCustomized ? `${companyName} PM AI Adoption Kit` : 'PM AI Adoption Kit';

  return {
    isCustomized,
    values: {
      '{{PERSONA_FIRST}}': personaFirst,
      '{{PERSONA_FULL}}': personaFull,
      '{{COMPANY_NAME}}': companyName,
      '{{PROJECT_NAME}}': projectName,
      '{{AGENT_NAME}}': agentName,
      '{{USE_CASE_BLURB}}': useCaseBlurb,
      '{{KIT_TITLE}}': kitTitle,
      '{{LOGO_IMG_TAG}}': '', // filled in at zip-build time once a logo is uploaded
    },
  };
}

function renderContent(raw, values, logoImgTag) {
  let out = raw;
  for (const [token, value] of Object.entries(values)) {
    if (token === '{{LOGO_IMG_TAG}}') continue;
    out = out.split(token).join(value);
  }
  out = out.split('{{LOGO_IMG_TAG}}').join(logoImgTag || '');
  return out;
}

async function fetchTemplate(filename) {
  const res = await fetch(KIT_TEMPLATE_DIR + filename);
  if (!res.ok) throw new Error(`Could not load template ${filename}: ${res.status}`);
  return res.text();
}

async function fetchDeckBlob() {
  const res = await fetch(KIT_TEMPLATE_DIR + DECK_FILE);
  if (!res.ok) throw new Error(`Could not load deck: ${res.status}`);
  return res.blob();
}

function buildReadme(values) {
  return `${values['{{KIT_TITLE}}']} — SharePoint Setup Guide
=================================================

WHAT'S IN THIS ZIP
- 6 self-contained HTML files (index.html + 4 modules + prompt-library.html)
- ${DECK_FILE} — a companion slide deck

HOW TO ADD THIS TO SHAREPOINT
1. Go to the SharePoint site/document library where you want to host the kit.
2. Upload all 6 .html files (and the .pptx, if you want it downloadable too) into their own
   folder in the library — keep them together so the links between modules keep working.
3. Open index.html directly in a browser (or link to it from a SharePoint page) to start the
   kit — it links out to each module and back.
4. Each learner's progress ("mark complete" checkboxes) is tracked locally in their own browser
   — there's no shared/central tracking in this version. If your team needs completion reporting
   through your LMS, ask about the SCORM-packaged version.

That's it — no installation, no build step, no server required.
`;
}

async function buildAndDownloadZip({ logoDataUri } = {}) {
  const { values } = resolveTokens();
  const logoImgTag = logoDataUri
    ? `<img src="${logoDataUri}" alt="logo" style="height:24px;margin-right:8px;vertical-align:middle;">`
    : '';

  const zip = new JSZip();

  for (const filename of KIT_FILES) {
    const raw = await fetchTemplate(filename);
    zip.file(filename, renderContent(raw, values, logoImgTag));
  }

  const deckBlob = await fetchDeckBlob();
  zip.file(DECK_FILE, deckBlob);
  zip.file('README.txt', buildReadme(values));

  const blob = await zip.generateAsync({ type: 'blob' });
  const safeCompany = values['{{COMPANY_NAME}}'].replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
  const downloadName = `${safeCompany}-PM-AI-Adoption-Kit.zip`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = downloadName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downscaleLogo(file, maxHeight = 150) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxHeight / img.height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
