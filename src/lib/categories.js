// Stored identifiers stay unchanged. Only their human-readable labels are normalized.
export const CATEGORY_LABELS = {
  'disaster-emergency': 'Disaster and Emergency', infrastructure:'Infrastructure',
  environment:'Environment', 'public-safety':'Public Safety', health:'Health',
  education:'Education', transportation:'Transportation', 'community-services':'Community Services',
  youth:'Youth Concerns', other:'Other',
};
export const categoryLabel = (slug,fallback) => CATEGORY_LABELS[slug] || fallback || slug;
