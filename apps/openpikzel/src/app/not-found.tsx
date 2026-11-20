import type { Metadata } from "next";
export const metadata: Metadata = { title: "Not found" };
export default function NotFound() {
 return <main className="not-found-page"><a className="brand" href="/welcome">OpenPikzels<span className="wordmark-pixel" aria-hidden="true"/></a><section><p>404</p><h1>Page not found</h1><p>That page isn’t here.</p><div><a className="primary-button inline-link" href="/studio">Open studio</a></div><p><a className="not-found-help" href="mailto:derrickserna.ca@gmail.com">Need help? Email us</a></p></section></main>;
}
