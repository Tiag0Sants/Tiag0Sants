const fs = require('fs');

const USERNAME = process.env.GITHUB_ACTOR || 'Tiag0Sants';
const TOKEN = process.env.GITHUB_TOKEN;

// Cores
const langColors = {
  HTML: "#e34c26", CSS: "#563d7c", Java: "#b07219", JavaScript: "#f1e05a", Python: "#3572A5", TypeScript: "#2b7489", Shell: "#89e051"
};
const statColors = { Commits: "#2ecc71", PRs: "#3498db", Issues: "#e74c3c", Stars: "#f1c40f" };

async function fetchGitHubData() {
  const query = `
    query {
      user(login: "${USERNAME}") {
        repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
          nodes { stargazerCount languages(first: 10, orderBy: {field: SIZE, direction: DESC}) { edges { size node { name color } } } }
        }
        contributionsCollection { totalCommitContributions totalPullRequestContributions totalIssueContributions }
      }
    }
  `;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data.user;
}

// Função de Desenho Melhorada (Sem gambiarras de replace)
function generateDonut(data, colors, title, centerText, subText, extraHTML = '') {
    const total = Object.values(data).reduce((a, b) => a + b, 0) || 1; // Evita divisão por zero
    let startAngle = 0;
    let paths = '';
    const cx = 100, cy = 100, r = 70;

    for (const [label, value] of Object.entries(data)) {
        if (value <= 0) continue;
        const percent = value / total;
        const angle = percent * 360;
        if (angle === 360) {
            // Caso seja 100% (círculo completo)
            paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colors[label] || '#ccc'}" stroke-width="15" />`;
        } else {
            const rRad = Math.PI / 180;
            const x1 = cx + r * Math.cos((startAngle - 90) * rRad);
            const y1 = cy + r * Math.sin((startAngle - 90) * rRad);
            const endAngle = startAngle + angle;
            const x2 = cx + r * Math.cos((endAngle - 90) * rRad);
            const y2 = cy + r * Math.sin((endAngle - 90) * rRad);
            const largeArc = angle > 180 ? 1 : 0;
            paths += `<path d="M${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2}" fill="none" stroke="${colors[label] || '#ccc'}" stroke-width="15" />`;
            startAngle = endAngle;
        }
    }

    // SVG Montado Corretamente
    return `
    <svg width="400" height="200" viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
      <style>
        .bg { fill: #0d1117; }
        .title { font: bold 16px 'Segoe UI', sans-serif; fill: #e6edf3; }
        .center { font: bold 22px 'Segoe UI', sans-serif; fill: #e6edf3; }
        .sub { font: 12px 'Segoe UI', sans-serif; fill: #8b949e; }
        .legend { font: 12px 'Segoe UI', sans-serif; fill: #e6edf3; }
      </style>
      <rect width="400" height="200" class="bg" rx="10" />
      
      <text x="200" y="25" text-anchor="middle" class="title">${title}</text>
      
      <g transform="translate(60, 20)">
        <circle cx="100" cy="100" r="70" fill="none" stroke="#21262d" stroke-width="15" />
        ${paths}
        <text x="100" y="95" text-anchor="middle" class="center">${centerText}</text>
        <text x="100" y="115" text-anchor="middle" class="sub">${subText}</text>
      </g>

      <g transform="translate(240, 70)">
         ${Object.keys(data).map((key, i) => `
            <circle cx="0" cy="${i*22}" r="5" fill="${colors[key] || '#ccc'}" />
            <text x="15" y="${i*22+4}" class="legend">${key}</text>
         `).join('')}
         ${extraHTML}
      </g>
    </svg>`;
}

async function main() {
  const data = await fetchGitHubData();
  
  // 1. Linguagens
  const langStats = {};
  data.repositories.nodes.forEach(repo => {
    repo.languages.edges.forEach(({ size, node }) => langStats[node.name] = (langStats[node.name] || 0) + size);
  });
  const topLangs = Object.entries(langStats).sort((a,b)=>b[1]-a[1]).slice(0,5).reduce((obj, [k,v]) => ({...obj, [k]:v}), {});
  
  fs.writeFileSync('languages.svg', generateDonut(topLangs, langColors, "Top Linguagens", Object.keys(topLangs).length, "Langs"));
  console.log("✅ languages.svg ok");

  // 2. Stats Gerais
  const stats = {
    Commits: data.contributionsCollection.totalCommitContributions,
    PRs: data.contributionsCollection.totalPullRequestContributions,
    Issues: data.contributionsCollection.totalIssueContributions
  };
  const totalStars = data.repositories.nodes.reduce((acc, r) => acc + r.stargazerCount, 0);
  const totalRepos = data.repositories.nodes.length;
  
  // HTML Extra injetado de forma limpa (Usei entidades HTML para os ícones para evitar erro de encoding)
  const extraHTML = `
    <g transform="translate(0, ${(Object.keys(stats).length * 22) + 10})">
      <text x="0" y="0" class="legend">&#11088; ${totalStars} Stars</text>
      <text x="0" y="22" class="legend">&#128218; ${totalRepos} Repos</text>
    </g>
  `;

  fs.writeFileSync('stats.svg', generateDonut(stats, statColors, "Minhas Contribuições", Object.values(stats).reduce((a,b)=>a+b,0), "Total", extraHTML));
  console.log("✅ stats.svg ok");
}

main().catch(console.error);
