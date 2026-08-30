import React, { useState, useEffect, useMemo } from 'react';

export interface RwandaAddress {
  province: string;
  provinceId: string;
  district: string;
  districtId: string;
  sector: string;
  sectorId: string;
  cell: string;
  cellId: string;
}

interface RwandaLocation {
  province: string;
  provinceId: string;
  district: string;
  districtId: string;
  sector: string;
  sectorId: string;
  cell: string;
  cellId: string;
}

interface RwandaAddressFormProps {
  value?: RwandaAddress;
  onChange?: (address: RwandaAddress) => void;
}

const RwandaAddressForm: React.FC<RwandaAddressFormProps> = ({ value, onChange }) => {
  const [locations, setLocations] = useState<RwandaLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [address, setAddress] = useState<RwandaAddress>(value || {
    province: '', provinceId: '',
    district: '', districtId: '',
    sector: '', sectorId: '',
    cell: '', cellId: ''
  });

  useEffect(() => {
    const fetchAllLocations = async () => {
      setIsLoading(true);
      setError(null);
      let allData: RwandaLocation[] = [];
      let offset = 0;
      const pageSize = 500;
      let hasMore = true;

      try {
        while (hasMore) {
          const url = `https://gis-server.statistics.gov.rw/server/rest/services/Hosted/Cell_Boundary_2022__Open_Data_/FeatureServer/2/query?where=1=1&outFields=province,province_id,district,district_id,sector,sector_id,cell,cell_id&returnGeometry=false&f=json&resultOffset=${offset}&resultRecordCount=${pageSize}&orderByFields=province_id ASC`;
          const response = await fetch(url);
          const data = await response.json();
          
          if (data.features && data.features.length > 0) {
            allData = [...allData, ...data.features.map((f: any) => ({
              province: f.attributes.province,
              provinceId: f.attributes.province_id,
              district: f.attributes.district,
              districtId: f.attributes.district_id,
              sector: f.attributes.sector,
              sectorId: f.attributes.sector_id,
              cell: f.attributes.cell,
              cellId: f.attributes.cell_id,
            }))];
            console.log(`Fetched batch: ${data.features.length}, Total so far: ${allData.length}`);
            offset += data.features.length;
            if (data.features.length < pageSize) hasMore = false;
          } else {
            console.log("No more features to fetch.");
            hasMore = false;
          }
        }
        console.log(`Final total features fetched: ${allData.length}`);
        setLocations(allData);
      } catch (err) {
        setError('Unable to load Rwanda administrative locations.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllLocations();
  }, []);

  const provinces = useMemo(() => {
    const map = new Map<string, string>();
    locations.forEach(l => map.set(l.provinceId, l.province));
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [locations]);

  const districts = useMemo(() => {
    if (!address.provinceId) return [];
    const map = new Map<string, string>();
    locations.filter(l => l.provinceId === address.provinceId).forEach(l => map.set(l.districtId, l.district));
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [locations, address.provinceId]);

  const sectors = useMemo(() => {
    if (!address.districtId) return [];
    const map = new Map<string, string>();
    locations.filter(l => l.districtId === address.districtId).forEach(l => map.set(l.sectorId, l.sector));
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [locations, address.districtId]);

  const cells = useMemo(() => {
    if (!address.sectorId) return [];
    const map = new Map<string, string>();
    locations.filter(l => l.sectorId === address.sectorId).forEach(l => map.set(l.cellId, l.cell));
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [locations, address.sectorId]);

  const handleUpdate = (newAddress: RwandaAddress) => {
    setAddress(newAddress);
    onChange?.(newAddress);
  };

  if (isLoading) return <div className="text-emerald-800">Loading Rwanda locations...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">Province</label>
        <select className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:ring-2 focus:ring-emerald-500" value={address.provinceId} onChange={(e) => {
          const name = provinces.find(p => p.id === e.target.value)?.name || '';
          handleUpdate({ province: name, provinceId: e.target.value, district: '', districtId: '', sector: '', sectorId: '', cell: '', cellId: '' });
        }}>
          <option value="">Select Province</option>
          {provinces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">District</label>
        <select className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100" value={address.districtId} disabled={!address.provinceId} onChange={(e) => {
          const name = districts.find(d => d.id === e.target.value)?.name || '';
          handleUpdate({ ...address, district: name, districtId: e.target.value, sector: '', sectorId: '', cell: '', cellId: '' });
        }}>
          <option value="">Select District</option>
          {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Sector</label>
        <select className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100" value={address.sectorId} disabled={!address.districtId} onChange={(e) => {
          const name = sectors.find(s => s.id === e.target.value)?.name || '';
          handleUpdate({ ...address, sector: name, sectorId: e.target.value, cell: '', cellId: '' });
        }}>
          <option value="">Select Sector</option>
          {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Cell</label>
        <select className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100" value={address.cellId} disabled={!address.sectorId} onChange={(e) => {
          const name = cells.find(c => c.id === e.target.value)?.name || '';
          handleUpdate({ ...address, cell: name, cellId: e.target.value });
        }}>
          <option value="">Select Cell</option>
          {cells.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
    </div>
  );
};

export default RwandaAddressForm;
