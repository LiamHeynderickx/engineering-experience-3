import React from "react";
import Image from "next/image";
import Link from "next/link";


const Header = async () => {
  return (
    <header className="text-white body-font bg-slate-900">
      <div className="container mx-auto flex flex-wrap p-5 flex-col md:flex-row items-center">
        <a
          href="#"
          className="flex title-font font-medium items-center md:justify-start justify-center text-gray-900"
        >
          <Image
            src={"/BattleCommand.png"}
            alt="Logo"
            width={40}
            height={40}
            className="bg-blue-950 rounded-full"
          />
          <span className="ml-3 text-xl text-white">
            Battle Command
          </span>
        </a>
        <nav
          className="md:mr-auto md:ml-4 md:py-1 md:pl-4 md:border-l md:border-gray-400 flex flex-wrap items-center text-base justify-center"
        >
          <Link className="mr-5 hover:text-gray-900" href="/">
            Home
          </Link>
          <Link className="mr-5 hover:text-gray-900" href="/game">
            Start Game
          </Link>
          <a className="mr-5 hover:text-gray-900" href="/rules">
            Rules
          </a>
          <Link className="mr-5 hover:text-gray-900" href="/about">
            About Us
          </Link>
        </nav>
        
      </div>
    </header>
  );
};

export default Header;
