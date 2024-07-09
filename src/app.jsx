import Head from "./components/head";
import { IoSearch } from 'solid-icons/io';

function App() {
  function searchType(e) {
    if (e.keyCode == 13) {
      var url = e.target.value
      e.target.value = ""

      return window.navigate(url);
    }
  }

  return (
    <>
      <Head />
      <div class="home">
        <div class="title">Midnight</div>
        <div class="omnibox">
          <div class="searchIcon">
            <IoSearch fill="var(--text-inverse)" />
          </div>
          <input onkeyup={searchType} placeholder="Search the web freely..." autofocus class="search" />
        </div>
      </div>
    </>
  );
}

export default App;
