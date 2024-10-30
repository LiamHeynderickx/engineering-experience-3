import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

export function useIsVisible(ref: React.RefObject<HTMLDivElement>) {
  const [isIntersecting, setIntersecting] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setIntersecting(entry.isIntersecting);
    });

    if (ref.current) {
      observer.observe(ref.current);
    }

    const refcurrent = ref.current;

    return () => {
      if (refcurrent) {
        observer.disconnect();
      }
    };
  }, [ref]);

  return isIntersecting;
}

const Rules = () => {
  const headerRef = useRef<HTMLDivElement>(null);
  const paragraphRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);

  const headerVisible = useIsVisible(headerRef);
  const paragraphVisible = useIsVisible(paragraphRef);
  const imageVisible = useIsVisible(imageRef);
  const buttonsVisible = useIsVisible(buttonsRef);

  return (
    <div className="min-h-screen bg-gradient-to-t from-gray-50 via-gray-200 to-gray-800 flex flex-col items-center justify-center">
      <div className="flex flex-col items-center mx-4 sm:mx-8 md:mx-16 lg:mx-32 xl:mx-40 mt-8 mb-8">
        <div
          ref={headerRef}
          className={`transition-opacity ease-in duration-700 ${
            headerVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <h1 className="text-6xl font-bold text-red-600 text-center mb-4">
            Learn the rules of WAR
          </h1>
        </div>

        <div
          ref={paragraphRef}
          className={`transition-opacity ease-in duration-700 delay-300 ${
            paragraphVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <p className="text-lg text-black text-center mb-6 max-w-4xl">
            Welcome to Battleship, where strategy reigns supreme! Each player hides a fleet of ships on a grid, taking turns to call out coordinates. Hit your opponent's ships before they sink yours! In BattleCommand, we modernize this classic by incorporating a physical board with a camera powered by OpenCV to detect ship placements. LED lights will provide instant feedback on hits and misses, while voice recognition adds an exciting twist. Our web-based app serves as the command center, creating a fun experience that bridges generations and revives the thrill of this timeless game!
          </p>
        </div>

        <div
          ref={imageRef}
          className={`relative w-full max-w-3xl h-96 mb-8 transition-opacity ease-in duration-1000 delay-600 ${
            imageVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <Image 
            src="/BattlePainting.png" 
            alt="Game Illustration" 
            layout="fill"
            objectFit="cover" 
            className="rounded-lg"
          />
        </div>

        <div
          ref={buttonsRef}
          className={`flex space-x-4 transition-opacity ease-in duration-700 delay-900 ${
            buttonsVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <button className="bg-blue-500 text-white px-6 py-3 rounded-full hover:bg-blue-700 transition duration-200">
            <Link href="./rules">Go to rules</Link>
          </button>
          <a 
            href="https://www.icrc.org/en/law-and-policy/geneva-conventions-and-their-commentaries" 
            target="_blank" 
            rel="noopener noreferrer"
          >
            <button className="bg-gray-500 text-white px-6 py-3 rounded-full hover:bg-gray-700 transition duration-200">
              Geneva Conventions
            </button>
          </a>
        </div>
      </div>
    </div>
  );
};

export default Rules;
