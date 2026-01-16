// Arquivo: scripts/generate-donut.js
const fs = require('fs');

// Configurações
const USERNAME = process.env.GITHUB_ACTOR || 'Tiag0Sants';
const TOKEN = process.env.GITHUB_TOKEN;
const OUTPUT_FILE = 'languages.svg';

// Cores Fallback (caso a API não retorne alguma)
const fallbackColors = {
  HTML: "#e34c26", CSS: "#563d7c", Java: "#b07219", JavaScript: "#f1e05a", Python: "#3572A5", TypeScript: "#2b7489"
};

async function fetchGitHubData() {
  const query = `
    query {
      user(login: "${USERNAME}") {
        repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
          nodes {
            languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
              edges { size node { name color } }
            }
          }
        }
      }
    }
  `;

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  
  const json = await response.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data.user.repositories.nodes;
}

async function main() {
  console.log(`🔍 Buscando dados para: ${USERNAME}...`);
  const repos = await fetchGitHubData();
  
  // 1. Processar e Somar Bytes
  const stats = {};
  const colors = {};
  let totalBytes = 0;

  repos.forEach(repo => {
    repo.languages.edges.forEach(({ size, node }) => {
      stats[node.name] = (stats[node.name] || 0) + size;
      colors[node.name] = node.color || fallbackColors[node.name] || '#ccc';
      totalBytes += size;
    });
  });

  // 2. Filtrar Top 5 e Agrupar "Outros"
  let sorted = Object.entries(stats).sort(([, a], [, b]) => b - a);
  let topLangs = sorted.slice(0, 5);
  const others = sorted.slice(5).reduce((acc, [, val]) => acc + val, 0);
  
  if (others > 0) {
    topLangs.push(['Others', others]);
    colors['Others'] = '#7f8c8d';
  }

  // 3. Gerar SVG (Lógica de Donut)
  let startAngle = 0;
  let paths = '';
  const cx = 100, cy = 100, r = 80; // Centro e Raio

  topLangs.forEach(([lang, bytes]) => {
    const percent = bytes / totalBytes;
    const angle = percent * 360;
    
    // Ajuste matemático para desenhar o arco
    const endAngle = startAngle + angle;
    const x1 = cx + r * Math.cos(Math.PI * startAngle / 180);
    const y1 = cy + r * Math.sin(Math.PI * startAngle / 180);
    const x2 = cx + r * Math.cos(Math.PI * endAngle / 180);
    const y2 = cy + r * Math.sin(Math.PI * endAngle / 180);
    
    // Se for 100% (círculo completo), o path muda um pouco, mas para stats raramente é.
    const largeArc = angle > 180 ? 1 : 0;
    
    paths += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z" fill="${colors[lang]}" stroke="#0d1117" stroke-width="2"/>`;
    
    startAngle = endAngle;
  });

  // Legenda (Opcional - mas fica bonito)
  // Vamos simplificar e deixar só o Donut puro e limpo como você queria
  
  const svgContent = `
    <svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <style>path { transition: 0.3s; } path:hover { opacity: 0.8; }</style>
      <circle cx="100" cy="100" r="100" fill="#0d1117" />
      
      <g transform="rotate(-90 100 100)">
        ${paths}
      </g>
      
      <circle cx="100" cy="100" r="50" fill="#0d1117" />
      
      <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#e6edf3" font-family="Segoe UI, sans-serif" font-weight="bold" font-size="20">
        ${topLangs.length} Langs
      </text>
    </svg>
  `;

  fs.writeFileSync(OUTPUT_FILE, svgContent);
  console.log(`✅ SVG gerado com sucesso: ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
