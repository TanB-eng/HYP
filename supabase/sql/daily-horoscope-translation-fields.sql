alter table daily_horoscopes
add column if not exists content_text_zh text,
add column if not exists theme_zh text,
add column if not exists keywords_zh text[] default '{}',
add column if not exists do_items_zh text[] default '{}',
add column if not exists dont_items_zh text[] default '{}',
add column if not exists supporting_insights_zh text[] default '{}',
add column if not exists translation_provider text,
add column if not exists translated_at timestamptz;

