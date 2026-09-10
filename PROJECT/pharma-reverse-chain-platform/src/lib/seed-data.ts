export const SEED_ACTORS = [
  { actorId: "PHARMACY_001", name: "CityCare Pharmacy", role: "Pharmacy", location: "New York, NY" },
  { actorId: "PHARMACY_002", name: "GreenCross Pharmacy", role: "Pharmacy", location: "Austin, TX" },
  { actorId: "DISTRIBUTOR_001", name: "MediTrans Logistics", role: "Distributor", location: "Chicago, IL" },
  { actorId: "DISTRIBUTOR_002", name: "SwiftPharma Distributors", role: "Distributor", location: "Atlanta, GA" },
  { actorId: "MANUFACTURER_001", name: "NovaGen Labs", role: "Manufacturer", location: "Boston, MA" },
  { actorId: "REGULATOR_001", name: "National Drug Authority", role: "Regulator", location: "Washington, DC" },
];

export type SeedBatch = {
  batchNumber: string;
  medicineName: string;
  manufacturerName: string;
  expiryDate: string;
  quantity: number;
  targetStatus: string;
};

export const SEED_BATCHES: SeedBatch[] = [
  {
    batchNumber: "NV-AMX-1001",
    medicineName: "Amoxicillin 500mg",
    manufacturerName: "NovaGen Labs",
    expiryDate: "2027-06-30",
    quantity: 5000,
    targetStatus: "ACTIVE",
  },
  {
    batchNumber: "NV-PAR-1002",
    medicineName: "Paracetamol 650mg",
    manufacturerName: "NovaGen Labs",
    expiryDate: "2026-11-15",
    quantity: 12000,
    targetStatus: "ACTIVE",
  },
  {
    batchNumber: "NV-IBU-1003",
    medicineName: "Ibuprofen 400mg",
    manufacturerName: "NovaGen Labs",
    expiryDate: "2025-12-01",
    quantity: 8000,
    targetStatus: "LOGGED_FOR_RETURN",
  },
  {
    batchNumber: "NV-MET-1004",
    medicineName: "Metformin 850mg",
    manufacturerName: "NovaGen Labs",
    expiryDate: "2026-03-20",
    quantity: 6000,
    targetStatus: "PICKUP_SCHEDULED",
  },
  {
    batchNumber: "NV-OMZ-1005",
    medicineName: "Omeprazole 20mg",
    manufacturerName: "NovaGen Labs",
    expiryDate: "2025-09-10",
    quantity: 4500,
    targetStatus: "RECEIVED_BY_DISTRIBUTOR",
  },
  {
    batchNumber: "NV-AZI-1006",
    medicineName: "Azithromycin 250mg",
    manufacturerName: "NovaGen Labs",
    expiryDate: "2026-01-25",
    quantity: 3000,
    targetStatus: "DISPUTED",
  },
  {
    batchNumber: "NV-LOS-1007",
    medicineName: "Losartan 50mg",
    manufacturerName: "NovaGen Labs",
    expiryDate: "2025-08-05",
    quantity: 7200,
    targetStatus: "WAITING_FOR_DESTRUCTION",
  },
  {
    batchNumber: "NV-CET-1008",
    medicineName: "Cetirizine 10mg",
    manufacturerName: "NovaGen Labs",
    expiryDate: "2024-12-31",
    quantity: 15000,
    targetStatus: "DESTROYED",
  },
  {
    batchNumber: "NV-ATOR-1009",
    medicineName: "Atorvastatin 20mg",
    manufacturerName: "NovaGen Labs",
    expiryDate: "2027-02-14",
    quantity: 9000,
    targetStatus: "ACTIVE",
  },
  {
    batchNumber: "NV-INS-1010",
    medicineName: "Insulin Glargine 100IU",
    manufacturerName: "NovaGen Labs",
    expiryDate: "2025-10-30",
    quantity: 1200,
    targetStatus: "DESTROYED",
  },
];

// Walk the legal path from ACTIVE to the target so the audit history is realistic.
export function pathTo(target: string): string[] {
  switch (target) {
    case "ACTIVE":
      return [];
    case "LOGGED_FOR_RETURN":
      return ["LOGGED_FOR_RETURN"];
    case "PICKUP_SCHEDULED":
      return ["LOGGED_FOR_RETURN", "PICKUP_SCHEDULED"];
    case "RECEIVED_BY_DISTRIBUTOR":
      return ["LOGGED_FOR_RETURN", "PICKUP_SCHEDULED", "RECEIVED_BY_DISTRIBUTOR"];
    case "DISPUTED":
      return [
        "LOGGED_FOR_RETURN",
        "PICKUP_SCHEDULED",
        "RECEIVED_BY_DISTRIBUTOR",
        "DISPUTED",
      ];
    case "WAITING_FOR_DESTRUCTION":
      return [
        "LOGGED_FOR_RETURN",
        "PICKUP_SCHEDULED",
        "RECEIVED_BY_DISTRIBUTOR",
        "WAITING_FOR_DESTRUCTION",
      ];
    case "DESTROYED":
      return [
        "LOGGED_FOR_RETURN",
        "PICKUP_SCHEDULED",
        "RECEIVED_BY_DISTRIBUTOR",
        "WAITING_FOR_DESTRUCTION",
        "DESTROYED",
      ];
    default:
      return [];
  }
}

export function actorForState(state: string): { role: string; name: string; remarks: string } {
  switch (state) {
    case "LOGGED_FOR_RETURN":
      return {
        role: "Pharmacy",
        name: "CityCare Pharmacy",
        remarks: "Return logged: expired / excess stock",
      };
    case "PICKUP_SCHEDULED":
      return {
        role: "Distributor",
        name: "MediTrans Logistics",
        remarks: "Pickup scheduled with pharmacy",
      };
    case "RECEIVED_BY_DISTRIBUTOR":
      return {
        role: "Distributor",
        name: "MediTrans Logistics",
        remarks: "Batch received at distributor warehouse",
      };
    case "DISPUTED":
      return {
        role: "Distributor",
        name: "MediTrans Logistics",
        remarks: "Quantity mismatch: counted 2,850 vs declared 3,000",
      };
    case "WAITING_FOR_DESTRUCTION":
      return {
        role: "Manufacturer",
        name: "NovaGen Labs",
        remarks: "Accepted for certified destruction",
      };
    case "DESTROYED":
      return {
        role: "Manufacturer",
        name: "NovaGen Labs",
        remarks: "Destroyed under supervision. Certificate issued.",
      };
    default:
      return { role: "System", name: "System", remarks: "Batch created" };
  }
}
