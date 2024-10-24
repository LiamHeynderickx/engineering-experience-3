import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";

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

const GameStart = () => {

    const headerRef = useRef<HTMLDivElement>(null);
    const paragraphRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLDivElement>(null);

    const headerVisible = useIsVisible(headerRef);
    const paragraphVisible = useIsVisible(paragraphRef);
    const buttonVisible = useIsVisible(buttonRef);
    const imageVisible = useIsVisible(imageRef);

    return (
        <div className="grid grid-cols-2 gap-4 place-items-center mb-40 mt-10">
            <div className="w-1/2">
                <div
                ref={headerRef}
                className={`transition-opacity ease-in duration-700 ${headerVisible ? "opacity-100" : "opacity-0"}`}
                >
                    <h2 className="text-red-600 text-4xl font-bold mb-4">Command Your Fleet, Dominate the Seas!</h2>
                </div>
                <div
                ref={paragraphRef}
                className={`transition-opacity ease-in duration-700 delay-300 ${paragraphVisible ? "opacity-100" : "opacity-0"}`}
                >
                    <p className="mb-4 text-lg">Lead your fleet to victory by planning your strategy carefully and
                    striking down the enemy forces!</p>
                </div>
                <div
                ref={buttonRef}
                className={`transition-opacity ease-in duration-700 delay-600 ${buttonVisible ? "opacity-100" : "opacity-0"}`}
                >
                    <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700 transition duration-200 ml-32">
                        Start War
                    </button>
                </div>

            </div>
            <div
                ref={imageRef}
                className={`transition-opacity bg-black/10 rounded-lg shadow-lg ease-in duration-2000 delay-600 ${imageVisible ? "opacity-100" : "opacity-0"}`}
            >
                <Image 
                src="/BattlePainting.png" 
                alt="Game Illustration"
                width={700}
                height={700}
                className="object-cover rounded"
                />
            </div>
      </div>
      );

};
export default GameStart;