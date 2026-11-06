export const POLICY_VERSION = '2026-11-02'

export const CAFE = {
  name: "Clayanna's Café",
  email: 'hello@clayannascafe.ph',
  phone: '0917 000 0000',
  address: 'Macasaet Building, Roxas Drive, Brgy. Guinobatan, Calapan City',
  fullAddress: 'Macasaet Building, Roxas Drive, Brgy. Guinobatan, Calapan City, Oriental Mindoro',
  landmark: 'The yellow building along Roxas Drive',
  hours: 'Open daily, 8:00 AM to 10:00 PM (Saturdays until 10:30 PM)',
  schedule: { open: 480, close: { default: 1320, Sat: 1350 } },
  mapEmbed: 'https://www.openstreetmap.org/export/embed.html?bbox=121.1773%2C13.3847%2C121.1834%2C13.3893&layer=mapnik&marker=13.3869752%2C121.1803488',
  mapLink: 'https://www.google.com/maps/search/?api=1&query=13.3869752%2C121.1803488',
}

export const POLICIES = [
  {
    slug: 'terms',
    title: 'Terms and ordering policy',
    sections: [
      {
        heading: 'Ordering',
        items: [
          'You need an account to order. Please give a correct name, email and mobile number so we can reach you about your order.',
          'Choose pickup or delivery and a time slot at checkout. Made-to-order items need the preparation time shown on each product; ready-made items can be ordered from the next open slot.',
          'Prices are in Philippine pesos. Our server checks the final total, including the delivery fee for your area.',
        ],
      },
      {
        heading: 'Payment',
        items: [
          'Online orders are paid in full when you order, through PayMongo (GCash or card). Your order is confirmed once the payment goes through. An unpaid online order is held for 60 minutes and then cancelled.',
          'Cash at the counter is available for pickup orders only, after you verify your email. Your order is confirmed right away; please pay the full amount when you pick it up and show your claim code.',
        ],
      },
      {
        heading: 'Pickup and delivery',
        items: [
          'Pick up during your chosen time slot and show your 4-digit claim code. Someone else can pick up if you add their name and number at checkout.',
          'Delivery is only to the areas listed at checkout. Please make sure someone is there to receive the order.',
          'Orders not collected on the day are kept until closing. After that we cannot guarantee freshness.',
        ],
      },
      {
        heading: 'Allergens',
        items: [
          "Ingredients and allergens are listed on each product. Our kitchen also handles nuts, eggs, dairy and wheat, so we can't guarantee any item is allergen-free.",
          'Tell us about allergies in the "Any allergies we should know?" box at checkout.',
        ],
      },
    ],
  },
  {
    slug: 'cancellation',
    title: 'Cancellation and refund policy',
    sections: [
      {
        heading: 'Cancelling or moving your order',
        items: [
          'You can cancel an unpaid order at any time from My orders.',
          'For a confirmed order, you can cancel it for free, or move it to another time slot once, up to 24 hours before your time slot, as long as we have not started preparing it.',
          'Less than 24 hours before your slot, or once your order is being prepared, please contact the café. We will do our best, but custom cakes that are already being made cannot be refunded.',
        ],
      },
      {
        heading: 'Refunds',
        items: [
          'Refunds for online payments are sent back by the café through the original payment method (GCash or card). It may take a few days to appear in your account.',
          'For cash orders that were already paid, the café refunds you in cash at the counter or by GCash.',
          'If we have to cancel your order (for example, an item sold out), we give you a full refund or let you choose another date.',
        ],
      },
    ],
  },
  {
    slug: 'privacy',
    title: 'Privacy notice',
    sections: [
      {
        heading: 'What we collect',
        items: [
          'Your name, email address and mobile number.',
          'Delivery address and landmark, if you choose delivery.',
          'Order details: items, options, cake messages, notes, recipient name and number, pickup person, and payment status.',
          'Allergy information you choose to give us (your profile allergies and the allergy note on an order).',
        ],
      },
      {
        heading: 'Why we use it',
        items: [
          'To take, prepare, deliver and confirm your orders, and to contact you about them by email and SMS.',
          'To warn you about allergens and keep your order safe.',
          'To keep sales records required by law and to handle refunds.',
        ],
      },
      {
        heading: 'Who sees it',
        items: [
          'Café staff who prepare and hand over your order.',
          'PayMongo, to process online payments. We never see or store your full card details.',
          'Our email and SMS providers, to send order updates.',
          'Cloudinary, if you upload a photo (for example, a cake design).',
          'We do not sell your data or use it for advertising.',
        ],
      },
      {
        heading: 'How long we keep it',
        items: [
          'We keep order and payment records for as long as the law requires for business records. Account details are kept while your account is active.',
        ],
      },
      {
        heading: 'Your rights',
        items: [
          'Under the Data Privacy Act of 2012 (Republic Act No. 10173), you can ask to see, correct or delete your personal data, or object to how we use it. Email us and we will reply within a reasonable time.',
          'You can update your name, mobile number and allergies anytime on your Profile page.',
        ],
      },
    ],
  },
]
