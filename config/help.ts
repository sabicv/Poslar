// The how-to videos the app has a place for. Vedran records them and
// pastes the links in the tower (Toranj → Upute); a topic without a link
// shows nothing. "owner": the screen is the owner's only.

export interface HelpTopic {
  id: string;
  title: string;
  where: string;
  owner?: boolean;
}

export const HELP_TOPICS: HelpTopic[] = [
  { id: 'start', title: 'Prvi dan s Poslarom', where: 'Pomoć i Prvi koraci' },
  { id: 'install', title: 'Aplikacija na početnom zaslonu mobitela', where: 'Pomoć' },
  { id: 'new_job', title: 'Novi nalog: izgovorite ili slikajte', where: 'Novi nalog' },
  { id: 'job', title: 'Rad na nalogu: slike, stavke, odobrenje', where: 'Pomoć' },
  { id: 'invoice', title: 'Račun i naplata', where: 'Račun', owner: true },
  { id: 'team', title: 'Dodavanje radnika', where: 'Postavke → Tim', owner: true },
  { id: 'pricing', title: 'Cjenik i predlošci', where: 'Postavke → Cjenik i predlošci', owner: true },
  { id: 'qr', title: 'QR samoprijem na vratima', where: 'Postavke → QR samoprijem', owner: true },
  { id: 'reminders', title: 'Podsjetnici mušterijama', where: 'Poslovanje → Podsjetnici', owner: true },
  { id: 'accountant', title: 'Paket za knjigovođu', where: 'Poslovanje → Za knjigovođu', owner: true },
];

export const HELP_TOPIC_IDS = HELP_TOPICS.map((t) => t.id);
