'use client'

import React from 'react';

interface Ship {
  id: string;
  name: string;
  length: number;
  hits: number;
}

interface ShipStatusProps {
  ships: Ship[];
  title: string;
}

const ShipStatus: React.FC<ShipStatusProps> = ({ ships, title }) => {
  return (
    <div className="bg-gray-800 text-white p-5 rounded-lg shadow-lg h-full">
      <h3 className="text-xl font-bold mb-4 text-center">{title}</h3>
      
      <div className="space-y-3">
        {ships.map((ship) => (
          <div key={ship.id} className="ship-status-item">
            <div className="flex items-center justify-between">
              <span className="font-medium text-blue-300">
                {ship.name}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ShipStatus; 