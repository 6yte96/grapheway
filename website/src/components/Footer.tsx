import { PROJECT_CONFIG } from "@/config";

export function Footer() {
  const { brand, links, meta, nav, support } = PROJECT_CONFIG;
  const currentYear = new Date().getFullYear();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/grapheway";

  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-section">
          <h3>
            <span className="brand-title">{brand.name}</span>
            {brand.domainSuffix ? <span className="brand-domain">{brand.domainSuffix}</span> : null}
            <span className="brand-badge-beta">BETA</span>
          </h3>
          <p>{meta.description}</p>
        </div>

        <div className="footer-section">
          <h4>Navigation</h4>
          <div className="footer-links">
            {nav.map((item) => (
              <a key={item.id} href={`#${item.id}`} className="footer-link">
                {item.label}
              </a>
            ))}
          </div>
        </div>

        <div className="footer-section">
          <h4>Transmissions</h4>
          <div className="social-links">
            <a
              href={links.github}
              target="_blank"
              rel="noopener noreferrer"
              className="social-link"
              title="GitHub Repository"
            >
              <i className="fab fa-github"></i>
            </a>
            {links.npm && (
              <a
                href={links.npm}
                target="_blank"
                rel="noopener noreferrer"
                className="social-link"
                title="npm Package"
              >
                <i className="fab fa-npm"></i>
              </a>
            )}
            {links.sponsor && (
              <a
                href={links.sponsor}
                target="_blank"
                rel="noopener noreferrer"
                className="social-link"
                title="Sponsor"
              >
                <i className="fas fa-heart"></i>
              </a>
            )}
          </div>
          <div className="footer-links" style={{ marginTop: "0.75rem" }}>
            <a href={`${basePath}/adopters/`} className="footer-link">
              Live index
            </a>
            <a href={`${basePath}/llms.txt`} className="footer-link">
              llms.txt
            </a>
            <a href={`${basePath}/agents.json`} className="footer-link">
              agents.json
            </a>
            <a href={`${basePath}/readiness/`} className="footer-link">
              Readiness index
            </a>
            <a href={`${basePath}/docs/`} className="footer-link">
              Docs
            </a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p>
          &copy; {currentYear} {brand.name} Contributors.
        </p>
        <p className="footer-version">
          <a
            href={`${links.github}/blob/main/LICENSE`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "inherit", textDecoration: "underline" }}
          >
            {support.license} License
          </a>
          {" // "}
          {meta.version} // @{brand.handle}
        </p>
      </div>
    </footer>
  );
}
