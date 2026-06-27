// Mock court (sân) data for the find/host marketplace prototype.
// Replace with real API calls once the backend exposes a /courts resource.

export interface CourtListing {
  id: string;
  name: string;
  district: string;
  address: string;
  pricePerHour: number;
  courtCount: number;
  rating: number;
  ratingCount: number;
  distanceKm: number;
  openHours: string;
  amenities: string[];
  tone: "acid" | "sun" | "bubble" | "sky";
  emoji: string;
  boosted?: boolean;
  // host-only fields
  status?: "Đang hiển thị" | "Tạm ẩn";
  bookingsThisWeek?: number;
}

export const FIND_COURTS: CourtListing[] = [
  {
    id: "smash-arena",
    name: "Smash Arena",
    district: "Quận 7",
    address: "12 Nguyễn Lương Bằng, P. Tân Phú, Quận 7",
    pricePerHour: 120000,
    courtCount: 6,
    rating: 4.8,
    ratingCount: 214,
    distanceKm: 2.1,
    openHours: "06:00 – 23:00",
    amenities: ["Máy lạnh", "Bãi xe rộng", "Căng tin", "Cho thuê vợt"],
    tone: "acid",
    emoji: "🏸",
    boosted: true
  },
  {
    id: "victory-court",
    name: "Victory Badminton",
    district: "Bình Thạnh",
    address: "88 Điện Biên Phủ, P.15, Bình Thạnh",
    pricePerHour: 90000,
    courtCount: 4,
    rating: 4.6,
    ratingCount: 132,
    distanceKm: 3.7,
    openHours: "05:30 – 22:30",
    amenities: ["Bãi xe", "Nước uống", "Đèn LED"],
    tone: "sky",
    emoji: "🥇"
  },
  {
    id: "sky-shuttle",
    name: "Sky Shuttle Center",
    district: "Quận 1",
    address: "5 Tôn Đức Thắng, P. Bến Nghé, Quận 1",
    pricePerHour: 150000,
    courtCount: 8,
    rating: 4.9,
    ratingCount: 301,
    distanceKm: 1.2,
    openHours: "06:00 – 24:00",
    amenities: ["Máy lạnh", "Sàn chuẩn thi đấu", "Phòng tắm", "Cho thuê vợt", "Căng tin"],
    tone: "bubble",
    emoji: "☁️",
    boosted: true
  },
  {
    id: "phu-nhuan-club",
    name: "Phú Nhuận Club",
    district: "Phú Nhuận",
    address: "30 Hoàng Văn Thụ, P.9, Phú Nhuận",
    pricePerHour: 80000,
    courtCount: 3,
    rating: 4.4,
    ratingCount: 76,
    distanceKm: 4.5,
    openHours: "06:00 – 22:00",
    amenities: ["Bãi xe", "Nước uống"],
    tone: "sun",
    emoji: "🏟️"
  },
  {
    id: "thu-duc-dome",
    name: "Thủ Đức Dome",
    district: "TP. Thủ Đức",
    address: "200 Võ Văn Ngân, P. Bình Thọ, Thủ Đức",
    pricePerHour: 100000,
    courtCount: 5,
    rating: 4.7,
    ratingCount: 158,
    distanceKm: 8.9,
    openHours: "05:00 – 23:00",
    amenities: ["Máy lạnh", "Bãi xe rộng", "Căng tin", "Phòng tắm"],
    tone: "acid",
    emoji: "🔆"
  },
  {
    id: "go-vap-smashers",
    name: "Gò Vấp Smashers",
    district: "Gò Vấp",
    address: "115 Quang Trung, P.10, Gò Vấp",
    pricePerHour: 70000,
    courtCount: 4,
    rating: 4.3,
    ratingCount: 64,
    distanceKm: 6.2,
    openHours: "06:00 – 22:30",
    amenities: ["Bãi xe", "Đèn LED", "Nước uống"],
    tone: "sky",
    emoji: "💥"
  }
];

export const MY_COURTS: CourtListing[] = [
  {
    id: "my-court-1",
    name: "Sân nhà — Tân Bình",
    district: "Tân Bình",
    address: "45 Cộng Hòa, P.13, Tân Bình",
    pricePerHour: 95000,
    courtCount: 2,
    rating: 4.5,
    ratingCount: 28,
    distanceKm: 0,
    openHours: "06:00 – 22:00",
    amenities: ["Bãi xe", "Nước uống", "Đèn LED"],
    tone: "sun",
    emoji: "🏠",
    status: "Đang hiển thị",
    bookingsThisWeek: 12
  },
  {
    id: "my-court-2",
    name: "Sân phụ — Quận 12",
    district: "Quận 12",
    address: "9 Tô Ký, P. Tân Chánh Hiệp, Quận 12",
    pricePerHour: 60000,
    courtCount: 1,
    rating: 4.1,
    ratingCount: 9,
    distanceKm: 0,
    openHours: "07:00 – 21:00",
    amenities: ["Nước uống"],
    tone: "bubble",
    emoji: "🏸",
    status: "Tạm ẩn",
    bookingsThisWeek: 3
  }
];

export function findCourt(id: string): CourtListing | undefined {
  return [...FIND_COURTS, ...MY_COURTS].find((c) => c.id === id);
}

export function formatVnd(amount: number): string {
  return `${amount.toLocaleString("vi-VN")}đ`;
}
