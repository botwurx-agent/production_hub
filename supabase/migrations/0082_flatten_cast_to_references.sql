-- Collapse the cast layer to ONE object: a reference.
--
-- The entity / look / composition split modelled the domain correctly and cost
-- more than it returned. To generate one shot the operator had to keep a
-- hand-typed mirror of their platform's element library, in a vocabulary this
-- app invented, on a page away from the work, and then satisfy a linter about
-- it. A reference is what the platform actually has: an image, a name, and the
-- handle it gave back.
--
-- Nothing is dropped. Every look becomes a reference carrying its own handles,
-- sheets and shot assignments; ai_looks and ai_look_items are left in place,
-- unread, so this is reversible.
--
-- NOTE: applied in two parts. The loop below moves each look across, and the
-- follow-up insert re-adds the PARENT to any shot whose assignment the loop
-- repointed, since "Maya wearing LK-01" becomes two references, not one.

do $$
declare
  l record;
  new_id uuid;
  candidate text;
  n int;
begin
  for l in
    select k.id, k.entity_id, k.name, k.slug, k.description, k.prompt,
           k.studio_id, k.created_by,
           e.project_id, e.kind
    from public.ai_looks k
    join public.ai_entities e on e.id = k.entity_id
    order by k.created_at
  loop
    candidate := l.slug;
    n := 1;
    while exists (
      select 1 from public.ai_entities a
      where a.studio_id = l.studio_id
        and coalesce(a.project_id, '00000000-0000-0000-0000-000000000000'::uuid)
            = coalesce(l.project_id, '00000000-0000-0000-0000-000000000000'::uuid)
        and lower(a.slug) = lower(candidate)
    ) loop
      n := n + 1;
      candidate := l.slug || '_' || n::text;
    end loop;

    insert into public.ai_entities
      (studio_id, project_id, kind, name, slug, description, prompt, created_by)
    values
      (l.studio_id, l.project_id, l.kind, l.name, candidate, l.description,
       l.prompt, l.created_by)
    returning id into new_id;

    update public.ai_entity_handles set entity_id = new_id, look_id = null
      where look_id = l.id;
    update public.ai_generations set entity_id = new_id, look_id = null
      where look_id = l.id;

    delete from public.ai_shot_cast c
      where c.look_id = l.id
        and exists (
          select 1 from public.ai_shot_cast d
          where d.shot_id = c.shot_id and d.entity_id = new_id
        );
    update public.ai_shot_cast set entity_id = new_id, look_id = null
      where look_id = l.id;

    insert into public.ai_shot_cast (studio_id, shot_id, entity_id)
    select distinct c.studio_id, c.shot_id, l.entity_id
    from public.ai_shot_cast c
    where c.entity_id = new_id
      and not exists (
        select 1 from public.ai_shot_cast d
        where d.shot_id = c.shot_id and d.entity_id = l.entity_id
      )
    on conflict (shot_id, entity_id) do nothing;
  end loop;
end $$;

comment on table public.ai_looks is
  'RETIRED by 0082. Every row was flattened into ai_entities as a reference. Kept unread for rollback; do not write to it.';
comment on table public.ai_look_items is
  'RETIRED by 0082, see ai_looks.';
comment on column public.ai_shot_cast.look_id is
  'RETIRED by 0082. Always null now: a shot references a reference directly.';
