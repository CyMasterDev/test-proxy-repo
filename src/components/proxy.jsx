import { createSignal } from "solid-js";
import { IoCloseSharp } from 'solid-icons/io'

function Proxy() {
    const [currentURL, setCurrentURL] = createSignal("");

    function getURL(url) {
        return window.location.origin + __uv$config.prefix + __uv$config.encodeUrl(url);
    }
  
    function navigate(url) {
        // Check if the URL starts with "http://" or "https://"
        if (!/^https?:\/\//i.test(url)) {
            // Check if the URL looks like a domain name
            if (url.includes('.') && !url.includes(' ')) {
                url = 'https://' + url;
            } else {
                // It's a search term
                url = 'https://www.google.com/search?q=' + encodeURIComponent(url);
            }
        }
        setCurrentURL(getURL(url));
    }

    function closeWeb() {
        setCurrentURL("");
    }

    window.navigate = navigate;
    
    return (
        <>
            <iframe src={currentURL()} data-open={currentURL() ? "true" : "false"} class="web"></iframe>
            <div class="close" onclick={closeWeb}>
                <IoCloseSharp fill="var(--text-inverse)" />
            </div>
        </>
    );
}

export default Proxy;
