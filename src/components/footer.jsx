import { A } from "@solidjs/router";

function Footer() {
  return (
    <>
      <div class="footer">
        <div class="footerItem">© {String(new Date().getFullYear())} Hyperpixel Foundation.</div>
        <A href="/privacy" class="footerItem link">Privacy</A>
      </div>
    </>
  );
}

export default Footer;
