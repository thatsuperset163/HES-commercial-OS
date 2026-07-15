export type Quote = {
  text: string;
  author: string;
};

/** Heavyweights only — presidents, thinkers, writers, athletes, leaders. */
export const QUOTE_POOL: Quote[] = [
  // Athletes
  {
    text: "The most important thing is to try and inspire people so that they can be great in whatever they want to do.",
    author: "Kobe Bryant",
  },
  {
    text: "I can't relate to lazy people. We don't speak the same language. I don't understand you. I don't want to understand you.",
    author: "Kobe Bryant",
  },
  {
    text: "I've failed over and over and over again in my life. And that is why I succeed.",
    author: "Michael Jordan",
  },
  {
    text: "Some people want it to happen, some wish it would happen, others make it happen.",
    author: "Michael Jordan",
  },
  {
    text: "Don't count the days; make the days count.",
    author: "Muhammad Ali",
  },
  {
    text: "I hated every minute of training, but I said, 'Don't quit. Suffer now and live the rest of your life as a champion.'",
    author: "Muhammad Ali",
  },
  {
    text: "You miss 100% of the shots you don't take.",
    author: "Wayne Gretzky",
  },
  {
    text: "I really think a champion is defined not by their wins but by how they can recover when they fall.",
    author: "Serena Williams",
  },
  {
    text: "It's not whether you get knocked down, it's whether you get up.",
    author: "Vince Lombardi",
  },
  {
    text: "Winning isn't everything, but wanting to win is.",
    author: "Vince Lombardi",
  },
  {
    text: "Champions keep playing until they get it right.",
    author: "Billie Jean King",
  },
  {
    text: "The more I practice, the luckier I get.",
    author: "Gary Player",
  },
  {
    text: "I fear not the man who has practiced 10,000 kicks once, but I fear the man who has practiced one kick 10,000 times.",
    author: "Bruce Lee",
  },
  {
    text: "Be happy, but never satisfied.",
    author: "Bruce Lee",
  },
  {
    text: "Concentration and mental toughness are the margins of victory.",
    author: "Bill Russell",
  },
  {
    text: "The difference between the impossible and the possible lies in a person's determination.",
    author: "Tommy Lasorda",
  },

  // Presidents / statesmen
  {
    text: "Do what you can, with what you have, where you are.",
    author: "Theodore Roosevelt",
  },
  {
    text: "Speak softly and carry a big stick — you will go far.",
    author: "Theodore Roosevelt",
  },
  {
    text: "Far better it is to dare mighty things, to win glorious triumphs, even though checkered by failure, than to rank with those poor spirits who neither enjoy nor suffer much.",
    author: "Theodore Roosevelt",
  },
  {
    text: "Nearly all men can stand adversity, but if you want to test a man's character, give him power.",
    author: "Abraham Lincoln",
  },
  {
    text: "I am a slow walker, but I never walk back.",
    author: "Abraham Lincoln",
  },
  {
    text: "Ask not what your country can do for you — ask what you can do for your country.",
    author: "John F. Kennedy",
  },
  {
    text: "Efforts and courage are not enough without purpose and direction.",
    author: "John F. Kennedy",
  },
  {
    text: "The only thing we have to fear is fear itself.",
    author: "Franklin D. Roosevelt",
  },
  {
    text: "The only limit to our realization of tomorrow will be our doubts of today.",
    author: "Franklin D. Roosevelt",
  },
  {
    text: "I find that the harder I work, the more luck I seem to have.",
    author: "Thomas Jefferson",
  },
  {
    text: "Well done is better than well said.",
    author: "Benjamin Franklin",
  },
  {
    text: "Energy and persistence conquer all things.",
    author: "Benjamin Franklin",
  },
  {
    text: "Never, never, never give up.",
    author: "Winston Churchill",
  },
  {
    text: "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    author: "Winston Churchill",
  },
  {
    text: "Continuous effort — not strength or intelligence — is the key to unlocking our potential.",
    author: "Winston Churchill",
  },
  {
    text: "It always seems impossible until it's done.",
    author: "Nelson Mandela",
  },
  {
    text: "I never lose. I either win or learn.",
    author: "Nelson Mandela",
  },
  {
    text: "Victory belongs to the most persevering.",
    author: "Napoleon Bonaparte",
  },
  {
    text: "I am not afraid of an army of lions led by a sheep; I am afraid of an army of sheep led by a lion.",
    author: "Alexander the Great",
  },
  {
    text: "Duty, Honor, Country. Those three hallowed words reverently dictate what you ought to be, what you can be, what you will be.",
    author: "Douglas MacArthur",
  },
  {
    text: "A pint of sweat will save a gallon of blood.",
    author: "George S. Patton",
  },

  // Thinkers / writers / builders
  {
    text: "You have power over your mind — not outside events. Realize this, and you will find strength.",
    author: "Marcus Aurelius",
  },
  {
    text: "Waste no more time arguing about what a good man should be. Be one.",
    author: "Marcus Aurelius",
  },
  {
    text: "It is not because things are difficult that we do not dare; it is because we do not dare that they are difficult.",
    author: "Seneca",
  },
  {
    text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.",
    author: "Aristotle",
  },
  {
    text: "The unexamined life is not worth living.",
    author: "Socrates",
  },
  {
    text: "He who has a why to live can bear almost any how.",
    author: "Friedrich Nietzsche",
  },
  {
    text: "The journey of a thousand miles begins with one step.",
    author: "Lao Tzu",
  },
  {
    text: "Do the difficult things while they are easy and do the great things while they are small.",
    author: "Lao Tzu",
  },
  {
    text: "In the middle of every difficulty lies opportunity.",
    author: "Albert Einstein",
  },
  {
    text: "Strive not to be a success, but rather to be of value.",
    author: "Albert Einstein",
  },
  {
    text: "Whether you think you can, or you think you can't — you're right.",
    author: "Henry Ford",
  },
  {
    text: "The way to get started is to quit talking and begin doing.",
    author: "Walt Disney",
  },
  {
    text: "Your work is going to fill a large part of your life. The only way to be truly satisfied is to do what you believe is great work.",
    author: "Steve Jobs",
  },
  {
    text: "Stay hungry. Stay foolish.",
    author: "Steve Jobs",
  },
  {
    text: "I have not failed. I've just found 10,000 ways that won't work.",
    author: "Thomas Edison",
  },
  {
    text: "Genius is one percent inspiration and ninety-nine percent perspiration.",
    author: "Thomas Edison",
  },
  {
    text: "Don't be afraid to give up the good to go for the great.",
    author: "John D. Rockefeller",
  },
  {
    text: "If you can't fly then run, if you can't run then walk, if you can't walk then crawl, but whatever you do you have to keep moving forward.",
    author: "Martin Luther King Jr.",
  },
  {
    text: "The ultimate measure of a man is not where he stands in moments of comfort and convenience, but where he stands at times of challenge and controversy.",
    author: "Martin Luther King Jr.",
  },
  {
    text: "Nothing will work unless you do.",
    author: "Maya Angelou",
  },
  {
    text: "Success is liking yourself, liking what you do, and liking how you do it.",
    author: "Maya Angelou",
  },
  {
    text: "If you want to lift yourself up, lift up someone else.",
    author: "Booker T. Washington",
  },
  {
    text: "It is never too late to be what you might have been.",
    author: "George Eliot",
  },
  {
    text: "Be yourself; everyone else is already taken.",
    author: "Oscar Wilde",
  },
  {
    text: "The only true wisdom is in knowing you know nothing.",
    author: "Socrates",
  },
  {
    text: "No matter how good you get you can always get better, and that's the exciting part.",
    author: "Tiger Woods",
  },
  {
    text: "You have to believe in yourself when no one else does — that makes you a winner right there.",
    author: "Venus Williams",
  },
];

function hashDateKey(dateKey: string): number {
  let h = 2166136261;
  for (let i = 0; i < dateKey.length; i += 1) {
    h ^= dateKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Same date always returns the same quote. */
export function pickDailyQuote(dateKey: string): Quote {
  const idx = hashDateKey(dateKey) % QUOTE_POOL.length;
  return QUOTE_POOL[idx];
}
