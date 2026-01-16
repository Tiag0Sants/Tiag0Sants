const fs = require('fs');

// Configurações
const USERNAME = process.env.GITHUB_ACTOR || 'Tiag0Sants';
const TOKEN = process.env.GITHUB_TOKEN;

// Cores para o Donut de Linguagens
const langColors = {
  HTML: "#e34c26", CSS: "#563d7c", Java: "#b07219", JavaScript: "#f1e05a", Python: "#3572A5", TypeScript: "#2b7489", Shell: "#89e051"
};

// Cores para o Donut de Stats (Atividade)
const statColors = {
  Commits: "#2ecc71", // Verde
  PRs: "#3498db",     // Azul
  Issues: "#e74c3c",  // Vermelho
  Stars: "#f1c40f"    // Amarelo
};

async function fetchGitHubData() {
  const query = `
    query {
      user(login: "${USERNAME}") {
        repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
          nodes {
            stargazerCount
            languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
              edges { size node { name color } }
            }
          }
        }
        contributionsCollection {
          totalCommitContributions
          totalPullRequestContributions
          totalIssueContributions
        }
        followers { totalCount }
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
  return json.data.user;
}

function generateDonut(data, colors, title, centerText, subText) {
    const total = Object.values(data).reduce((a, b) => a + b, 0);
    let startAngle = 0;
    let paths = '';
    const cx = 100, cy = 100, r = 70; // Raio um pouco menor para caber texto

    // Fundo do arco (cinza escuro)
    paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#21262d" stroke-width="15" />`;

    for (const [label, value] of Object.entries(data)) {
        if (value === 0) continue;
        const percent = value / total;
        const angle = percent * 360;
        
        // Cálculo do Arco SVG
        const r2 = r; // Raio do arco
        const x1 = cx + r2 * Math.cos(Math.PI * (startAngle - 90) / 180);
        const y1 = cy + r2 * Math.sin(Math.PI * (startAngle - 90) / 180);
        const endAngle = startAngle + angle;
        const x2 = cx + r2 * Math.cos(Math.PI * (endAngle - 90) / 180);
        const y2 = cy + r2 * Math.sin(Math.PI * (endAngle - 90) / 180);
        const largeArc = angle > 180 ? 1 : 0;

        paths += `<path d="M${x1},${y1} A${r2},${r2} 0 ${largeArc},1 ${x2},${y2}" fill="none" stroke="${colors[label] || '#ccc'}" stroke-width="15" />`;
        startAngle = endAngle;
    }

    return `
    <svg width="300" height="200" viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg">
      <style>
        .title { font: bold 16px 'Segoe UI', sans-serif; fill: #e6edf3; }
        .center { font: bold 22px 'Segoe UI', sans-serif; fill: #e6edf3; }
        .sub { font: 12px 'Segoe UI', sans-serif; fill: #8b949e; }
        .legend { font: 12px 'Segoe UI', sans-serif; fill: #e6edf3; }
      </style>
      
      <text x="150" y="20" text-anchor="middle" class="title">${title}</text>
      
      <g transform="translate(50, 20)">
        ${paths}
        <text x="100" y="95" text-anchor="middle" class="center">${centerText}</text>
        <text x="100" y="115" text-anchor="middle" class="sub">${subText}</text>
      </g>

      <g transform="translate(210, 80)">
         ${Object.keys(data).map((key, i) => `
            <circle cx="0" cy="${i*20}" r="5" fill="${colors[key] || '#ccc'}" />
            <text x="10" y="${i*20+4}" class="legend">${key}</text>
         `).join('')}
      </g>
    </svg>
    `;
}

async function main() {
  console.log(`🔍 Buscando dados...`);
  const data = await fetchGitHubData();
  
  // --- 1. DADOS DE LINGUAGENS ---
  const langStats = {};
  let totalBytes = 0;
  data.repositories.nodes.forEach(repo => {
    repo.languages.edges.forEach(({ size, node }) => {
      langStats[node.name] = (langStats[node.name] || 0) + size;
      totalBytes += size;
    });
  });

  // Filtrar Top 5
  const topLangs = Object.entries(langStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {});

  // --- 2. DADOS DE STATS (Commits, PRs, Issues) ---
  const activityStats = {
    Commits: data.contributionsCollection.totalCommitContributions,
    PRs: data.contributionsCollection.totalPullRequestContributions,
    Issues: data.contributionsCollection.totalIssueContributions
  };
  
  // Calcular totais extras
  const totalStars = data.repositories.nodes.reduce((acc, repo) => acc + repo.stargazerCount, 0);
  const totalRepos = data.repositories.nodes.length;
  const totalContribs = activityStats.Commits + activityStats.PRs + activityStats.Issues;

  // --- 3. GERAR OS DOIS SVGs ---
  
  // SVG 1: Linguagens
  const svgLangs = generateDonut(
    topLangs, 
    langColors, 
    "Linguagens Mais Usadas", 
    Object.keys(topLangs).length, 
    "Linguagens"
  );
  fs.writeFileSync('languages.svg', svgLangs);
  console.log("✅ languages.svg gerado!");

  // SVG 2: Stats (Atividade)
  const svgStats = generateDonut(
    activityStats, 
    statColors, 
    "Atividade & Stats", 
    totalContribs, 
    "Contribuições"
  );
  
  // Adicionar texto extra de Repos e Stars no SVG de Stats manualmente (Hackzinho visual)
  const finalStatsSVG = svgStats.replace('</svg>', `
    <text x="210" y="160" class="legend">⭐ ${totalStars} Stars</text>
    <text x="210" y="180" class="legend">📚 ${totalRepos} Repos</text>
  </svg>`);

  fs.writeFileSync('stats.svg', finalStatsSVG);
  console.log("✅ stats.svg gerado!");
}

main().catch(console.error);
