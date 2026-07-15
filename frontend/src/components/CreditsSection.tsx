import reactLogo from "../assets/brands/react.svg";
import typescriptLogo from "../assets/brands/typescript.svg";
import viteLogo from "../assets/brands/vite.svg";
import tailwindLogo from "../assets/brands/tailwindcss.svg";
import phosphorLogo from "../assets/brands/phosphor-icons.svg";
import pythonLogo from "../assets/brands/python.svg";
import fastapiLogo from "../assets/brands/fastapi.svg";
import sqlalchemyLogo from "../assets/brands/sqlalchemy.svg";
import pydanticLogo from "../assets/brands/pydantic.svg";
import sqliteLogo from "../assets/brands/sqlite.svg";
import vitestLogo from "../assets/brands/vitest.svg";
import playwrightLogo from "../assets/brands/playwright.svg";
import dockerLogo from "../assets/brands/docker.svg";
import nginxLogo from "../assets/brands/nginx.svg";
import githubLogo from "../assets/brands/github.svg";
import hetznerLogo from "../assets/brands/hetzner.svg";
import pwaLogo from "../assets/brands/pwa.svg";
import nousLogo from "../assets/brands/nousresearch.svg";

// Brand marks (source art from brands.reicon.dev) keep their real colors and
// are shown on a small white tile. Many official logos are near-black
// (GitHub, Phosphor) or navy (SQLite); a constant light tile is the only way
// to keep every mark legible across both the light and dark themes. This is a
// deliberate, decorative use of a white background scoped to logo tiles only.
interface Credit {
  name: string;
  role: string;
  href: string;
  logo: string;
}

interface CreditGroup {
  title: string;
  items: Credit[];
}

const GROUPS: CreditGroup[] = [
  {
    title: "Frontend",
    items: [
      { name: "React", role: "UI library", href: "https://react.dev", logo: reactLogo },
      { name: "TypeScript", role: "Language", href: "https://www.typescriptlang.org", logo: typescriptLogo },
      { name: "Vite", role: "Build tool", href: "https://vite.dev", logo: viteLogo },
      { name: "Tailwind CSS", role: "Styling", href: "https://tailwindcss.com", logo: tailwindLogo },
      { name: "Phosphor Icons", role: "Icon set", href: "https://phosphoricons.com", logo: phosphorLogo },
    ],
  },
  {
    title: "Backend",
    items: [
      { name: "Python", role: "Language", href: "https://www.python.org", logo: pythonLogo },
      { name: "FastAPI", role: "Web framework", href: "https://fastapi.tiangolo.com", logo: fastapiLogo },
      { name: "SQLAlchemy", role: "ORM", href: "https://www.sqlalchemy.org", logo: sqlalchemyLogo },
      { name: "Pydantic", role: "Validation", href: "https://pydantic.dev", logo: pydanticLogo },
      { name: "SQLite", role: "Database", href: "https://www.sqlite.org", logo: sqliteLogo },
    ],
  },
  {
    title: "Testing",
    items: [
      { name: "Vitest", role: "Unit tests", href: "https://vitest.dev", logo: vitestLogo },
      { name: "Playwright", role: "E2E tests", href: "https://playwright.dev", logo: playwrightLogo },
    ],
  },
  {
    title: "Infrastructure",
    items: [
      { name: "Docker", role: "Containers", href: "https://www.docker.com", logo: dockerLogo },
      { name: "Nginx", role: "Web server", href: "https://nginx.org", logo: nginxLogo },
      { name: "GitHub", role: "CI/CD & registry", href: "https://github.com", logo: githubLogo },
      { name: "Hetzner", role: "Hosting", href: "https://www.hetzner.com", logo: hetznerLogo },
      { name: "PWA", role: "Installable app", href: "https://web.dev/explore/progressive-web-apps", logo: pwaLogo },
    ],
  },
  {
    title: "AI",
    items: [
      { name: "NousResearch", role: "Hermes models", href: "https://nousresearch.com", logo: nousLogo },
    ],
  },
];

function BrandIcon({ logo, label }: { logo: string; label: string }) {
  return (
    <span className="w-7 h-7 shrink-0 rounded-md bg-white flex items-center justify-center ring-1 ring-fg/10">
      <img src={logo} alt={label} className="w-5 h-5 object-contain" loading="lazy" />
    </span>
  );
}

export default function CreditsSection() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-fg/40">
        FitnessTracker is built on the shoulders of these open-source projects and providers.
      </p>
      {GROUPS.map((group) => (
        <div key={group.title}>
          <p className="text-xs text-fg/50 mb-1.5">{group.title}</p>
          <div className="space-y-1">
            {group.items.map((c) => (
              <a
                key={c.name}
                href={c.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-fg/5 transition-colors"
              >
                <BrandIcon logo={c.logo} label={c.name} />
                <span className="text-sm text-fg/80 group-hover:text-fg transition-colors">
                  {c.name}
                </span>
                <span className="ml-auto text-[11px] text-fg/40">{c.role}</span>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
