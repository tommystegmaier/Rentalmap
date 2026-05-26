'use client';

import { useRouter } from 'next/navigation';
import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { createInspection } from './actions';
import { updateInspection } from '../[id]/edit/actions';
import { Plus, Trash2, Upload } from 'lucide-react';

const DEFAULT_ROOMS = [
  'Living Room',
  'Kitchen',
  'Primary Bedroom',
  'Bathroom',
  'Hallway',
  'Exterior',
];

const DEFAULT_ITEMS = ['Walls', 'Floors', 'Ceiling', 'Windows', 'Doors'];

const CONDITIONS = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'na', label: 'N/A' },
] as const;

type Condition = (typeof CONDITIONS)[number]['value'];

interface InspectionItemState {
  id: string;
  item: string;
  condition: Condition;
  notes: string;
  photos: File[];
  photoPaths: string[];
}

interface RoomState {
  id: string;
  name: string;
  items: InspectionItemState[];
}

interface LeaseOption {
  id: string;
  start_date: string;
  end_date: string | null;
}

interface PropertyOption {
  id: string;
  address: string;
  leases: LeaseOption[];
}

interface NewInspectionFormProps {
  properties: PropertyOption[];
  /** Pre-select this property when arriving from a property detail page */
  initialPropertyId?: string;
  /** When set, the form updates an existing inspection instead of creating one */
  editInspectionId?: string;
  initialData?: {
    propertyId: string;
    leaseId: string | null;
    type: string;
    conductedDate: string;
    overallNotes: string;
    rooms: RoomState[];
  };
}

function uid() {
  return Math.random().toString(36).slice(2);
}

function makeDefaultRooms(): RoomState[] {
  return DEFAULT_ROOMS.map((name) => ({
    id: uid(),
    name,
    items: DEFAULT_ITEMS.map((item) => ({
      id: uid(),
      item,
      condition: 'good' as Condition,
      notes: '',
      photos: [],
      photoPaths: [],
    })),
  }));
}

export function NewInspectionForm({ properties, initialPropertyId, editInspectionId, initialData }: NewInspectionFormProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1 state
  const [propertyId, setPropertyId] = useState(initialData?.propertyId ?? initialPropertyId ?? properties[0]?.id ?? '');
  const [leaseId, setLeaseId] = useState<string>(initialData?.leaseId ?? '');
  const [inspType, setInspType] = useState(initialData?.type ?? 'move_in');
  const [conductedDate, setConductedDate] = useState(
    initialData?.conductedDate ?? new Date().toISOString().slice(0, 10),
  );

  // Step 2 state
  const [rooms, setRooms] = useState<RoomState[]>(initialData?.rooms ?? makeDefaultRooms());
  const [newRoomName, setNewRoomName] = useState('');

  // Step 3 state
  const [overallNotes, setOverallNotes] = useState(initialData?.overallNotes ?? '');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProperty = properties.find((p) => p.id === propertyId);
  const leaseOptions = selectedProperty?.leases ?? [];

  // ── Room helpers ──────────────────────────────────────────────────────────

  function addRoom() {
    const name = newRoomName.trim();
    if (!name) return;
    setRooms((prev) => [
      ...prev,
      {
        id: uid(),
        name,
        items: DEFAULT_ITEMS.map((item) => ({
          id: uid(),
          item,
          condition: 'good' as Condition,
          notes: '',
          photos: [],
          photoPaths: [],
        })),
      },
    ]);
    setNewRoomName('');
  }

  function removeRoom(roomId: string) {
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
  }

  function addItem(roomId: string) {
    setRooms((prev) =>
      prev.map((r) =>
        r.id === roomId
          ? {
              ...r,
              items: [
                ...r.items,
                { id: uid(), item: '', condition: 'good' as Condition, notes: '', photos: [], photoPaths: [] },
              ],
            }
          : r,
      ),
    );
  }

  function removeItem(roomId: string, itemId: string) {
    setRooms((prev) =>
      prev.map((r) =>
        r.id === roomId ? { ...r, items: r.items.filter((i) => i.id !== itemId) } : r,
      ),
    );
  }

  function updateItem(
    roomId: string,
    itemId: string,
    patch: Partial<InspectionItemState>,
  ) {
    setRooms((prev) =>
      prev.map((r) =>
        r.id === roomId
          ? { ...r, items: r.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }
          : r,
      ),
    );
  }

  const handlePhotoFiles = useCallback(
    (roomId: string, itemId: string, files: FileList | null) => {
      if (!files) return;
      const selected = Array.from(files).slice(0, 3);
      updateItem(roomId, itemId, { photos: selected });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setError(null);
    setBusy(true);
    try {
      const supabase = createClient();

      // Upload all photos client-side first, collect paths
      const roomsWithPaths: RoomState[] = [];
      for (const room of rooms) {
        const itemsWithPaths: InspectionItemState[] = [];
        for (const item of room.items) {
          const paths: string[] = [];
          for (const photo of item.photos) {
            const ext = photo.name.split('.').pop() ?? 'jpg';
            const path = `${Date.now()}-${uid()}.${ext}`;
            const { error: upErr } = await supabase.storage
              .from('inspection-photos')
              .upload(path, photo, { upsert: false });
            if (upErr) throw upErr;
            paths.push(path);
          }
          itemsWithPaths.push({ ...item, photoPaths: paths });
        }
        roomsWithPaths.push({ ...room, items: itemsWithPaths });
      }

      let sortOrder = 0;
      const itemPayload = roomsWithPaths.flatMap((room) =>
        room.items.map((item) => ({
          room: room.name,
          item: item.item || 'Item',
          condition: item.condition,
          notes: item.notes || null,
          photo_urls: item.photoPaths,
          sort_order: sortOrder++,
        })),
      );

      if (editInspectionId) {
        const { error: actionError } = await updateInspection(editInspectionId, {
          propertyId,
          leaseId: leaseId || null,
          type: inspType,
          date: conductedDate,
          notes: overallNotes || null,
          items: itemPayload,
        });
        if (actionError) throw new Error(actionError);
        router.push(`/landlord/inspections/${editInspectionId}`);
      } else {
        const { inspectionId, error: actionError } = await createInspection({
          propertyId,
          leaseId: leaseId || null,
          type: inspType,
          date: conductedDate,
          notes: overallNotes || null,
          items: itemPayload,
        });
        if (actionError) throw new Error(actionError);
        router.push(`/landlord/inspections/${inspectionId}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  // ── Step indicators ───────────────────────────────────────────────────────

  const steps = ['Details', 'Checklist', 'Notes & Submit'];

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                i + 1 === step
                  ? 'bg-primary text-primary-foreground'
                  : i + 1 < step
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {i + 1}
            </span>
            <span className={`text-sm ${i + 1 === step ? 'font-medium' : 'text-muted-foreground'}`}>
              {s}
            </span>
            {i < steps.length - 1 && <span className="text-muted-foreground">·</span>}
          </div>
        ))}
      </div>

      {/* ── Step 1: Details ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="property">Property</Label>
            <Select
              id="property"
              value={propertyId}
              onChange={(e) => {
                setPropertyId(e.target.value);
                setLeaseId('');
              }}
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.address}
                </option>
              ))}
            </Select>
          </div>

          {leaseOptions.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="lease">Lease (optional)</Label>
              <Select
                id="lease"
                value={leaseId}
                onChange={(e) => setLeaseId(e.target.value)}
              >
                <option value="">— None —</option>
                {leaseOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.start_date}
                    {l.end_date ? ` – ${l.end_date}` : ' (ongoing)'}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="type">Inspection type</Label>
            <Select id="type" value={inspType} onChange={(e) => setInspType(e.target.value)}>
              <option value="move_in">Move-in</option>
              <option value="move_out">Move-out</option>
              <option value="periodic">Periodic</option>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={conductedDate}
              onChange={(e) => setConductedDate(e.target.value)}
              required
            />
          </div>

          <Button
            className="w-full"
            disabled={!propertyId || !conductedDate}
            onClick={() => setStep(2)}
          >
            Next: Checklist
          </Button>
        </div>
      )}

      {/* ── Step 2: Checklist ── */}
      {step === 2 && (
        <div className="space-y-6">
          {rooms.map((room) => (
            <Card key={room.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">{room.name}</CardTitle>
                <button
                  type="button"
                  onClick={() => removeRoom(room.id)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${room.name}`}
                >
                  <Trash2 size={16} />
                </button>
              </CardHeader>
              <CardContent className="space-y-4">
                {room.items.map((itm) => (
                  <div key={itm.id} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <Input
                        value={itm.item}
                        placeholder="Item name"
                        onChange={(e) => updateItem(room.id, itm.id, { item: e.target.value })}
                        className="flex-1"
                      />
                      <Select
                        value={itm.condition}
                        onChange={(e) =>
                          updateItem(room.id, itm.id, { condition: e.target.value as Condition })
                        }
                        className="w-32"
                      >
                        {CONDITIONS.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </Select>
                      <button
                        type="button"
                        onClick={() => removeItem(room.id, itm.id)}
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label="Remove item"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <Textarea
                      rows={2}
                      placeholder="Notes (optional)"
                      value={itm.notes}
                      onChange={(e) => updateItem(room.id, itm.id, { notes: e.target.value })}
                    />

                    <div className="space-y-1">
                      <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                        <Upload size={12} />
                        Photos (up to 3)
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="sr-only"
                          onChange={(e) => handlePhotoFiles(room.id, itm.id, e.target.files)}
                        />
                      </label>
                      {itm.photos.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {itm.photos.length} photo{itm.photos.length === 1 ? '' : 's'} selected
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => addItem(room.id)}
                  className="flex items-center gap-1 text-xs text-primary"
                >
                  <Plus size={14} /> Add item
                </button>
              </CardContent>
            </Card>
          ))}

          {/* Add room */}
          <div className="flex gap-2">
            <Input
              placeholder="New room name"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addRoom();
                }
              }}
            />
            <Button type="button" variant="outline" onClick={addRoom} disabled={!newRoomName.trim()}>
              <Plus size={16} />
            </Button>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button className="flex-1" onClick={() => setStep(3)}>
              Next: Notes
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Overall notes + submit ── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notes">Overall notes (optional)</Label>
            <Textarea
              id="notes"
              rows={5}
              placeholder="Any general observations about the property…"
              value={overallNotes}
              onChange={(e) => setOverallNotes(e.target.value)}
            />
          </div>

          {/* Summary badges */}
          <div className="flex flex-wrap gap-2">
            <Badge className="border-transparent bg-muted text-muted-foreground">
              {rooms.length} room{rooms.length === 1 ? '' : 's'}
            </Badge>
            <Badge className="border-transparent bg-muted text-muted-foreground">
              {rooms.reduce((n, r) => n + r.items.length, 0)} items
            </Badge>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button className="flex-1" disabled={busy} onClick={handleSubmit}>
              {busy ? 'Saving…' : editInspectionId ? 'Update inspection' : 'Save inspection'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
