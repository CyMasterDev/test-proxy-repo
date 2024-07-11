import Logo from '../assets/logo.svg';
import { A } from "@solidjs/router";
import { IoOptions } from 'solid-icons/io';
import { IoGameController } from 'solid-icons/io';
import { AiOutlineGithub } from 'solid-icons/ai';
import { AiFillHome } from 'solid-icons/ai'

function Nav() {
  function gamesGo() {
    window.navigate("https://radon.games/games")
  }

  return (
    <>
      <div class="nav">
        <div class="navItems">
            <A href="/" class="navItem">
                <AiFillHome fill="var(--text-inverse)" />
            </A>
            <a href="https://github.com/Hyperpixel-Foundation/Midnight" class="navItem">
                <AiOutlineGithub fill="var(--text-inverse)" />
            </a>
            <div onclick={gamesGo} class="navItem">
                <IoGameController fill="var(--text-inverse)" />
            </div>
            <A href="/options" class="navItem">
                <IoOptions fill="var(--text-inverse)" />
            </A>
        </div>
      </div>
    </>
  );
}

export default Nav;
