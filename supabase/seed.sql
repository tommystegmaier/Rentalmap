-- Seed for Tommy's first property and lease.
-- This script seeds the *property and lease* only; users are created via Supabase Auth signup
-- (which auto-creates a row in public.users via the on_auth_user_created trigger).
--
-- After signing up as the landlord, run this from psql or the Supabase SQL editor,
-- replacing :owner_id with your auth user id.

-- Example (in SQL editor, after replacing the uuid):
-- \set owner_id '00000000-0000-0000-0000-000000000000'

do $$
declare
  v_owner_id uuid := :'owner_id'::uuid;
  v_property_id uuid;
  v_lease_id uuid;
begin
  -- Promote to landlord
  update public.users set role = 'landlord', name = coalesce(name, 'Tommy Stegmaier')
   where id = v_owner_id;

  -- Property
  insert into public.properties (
    owner_id, address, type, purchase_price_cents,
    placed_in_service, depreciable_basis_cents, annual_depreciation_cents
  ) values (
    v_owner_id,
    '16303 Holmes St, Omaha, NE 68135',
    'single_family',
    24800000,            -- $248,000
    '2026-06-01',
    21898400,            -- $218,984
    796300               -- $7,963
  )
  returning id into v_property_id;

  -- Lease
  insert into public.leases (
    property_id, start_date, end_date, monthly_rent_cents,
    due_day, late_after_day, late_fee_cents, security_deposit_cents,
    pets_allowed, utilities_paid_by, lawn_care_by,
    terms_notes, status
  ) values (
    v_property_id,
    '2026-06-01', '2027-05-31',
    270000,              -- $2,700
    1, 5, 5000, 270000,
    true, 'tenant', 'tenant',
    'Landlord access quarterly for HVAC and inspections. ' ||
    'Early termination: 30 days notice plus the greater of remaining rent or two months rent. ' ||
    'Holdover: 150% monthly rent, no month-to-month fallback. ' ||
    'Year 2 and Year 3 renewal: reduced rate option tied to payment history.',
    'active'
  )
  returning id into v_lease_id;

  -- Appliance starter rows
  insert into public.appliances (property_id, name) values
    (v_property_id, 'HVAC'),
    (v_property_id, 'Water Heater'),
    (v_property_id, 'Smoke Detectors'),
    (v_property_id, 'CO Detectors'),
    (v_property_id, 'Dishwasher'),
    (v_property_id, 'Washer'),
    (v_property_id, 'Dryer'),
    (v_property_id, 'Refrigerator'),
    (v_property_id, 'Garage Door Opener');

  raise notice 'Seeded property % with lease %', v_property_id, v_lease_id;
end $$;
