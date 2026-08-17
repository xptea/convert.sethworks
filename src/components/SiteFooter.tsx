export function SiteFooter() {
  return (
    <footer className="py-5 text-center text-xs text-muted-foreground">
      <span>© {new Date().getFullYear()}       <a
        href="https://sethworks.xyz"
        target="_blank"
        rel="noreferrer"
        className="text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
      >
        sethworks.xyz
      </a></span>
    </footer>
  )
}
