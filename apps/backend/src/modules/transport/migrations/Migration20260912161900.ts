import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260912161900 extends Migration {
  async up(): Promise<void> {
    this.addSql('create table if not exists "transport_zone" ("id" text not null, "name" text not null, "active" boolean not null default false, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "transport_zone_pkey" primary key ("id"));')
    this.addSql('create table if not exists "transport_zone_cell" ("id" text not null, "zone_id" text not null, "cell" text not null, "resolution" integer not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "transport_zone_cell_pkey" primary key ("id"));')
    this.addSql('create table if not exists "transport_vehicle_class" ("id" text not null, "name" text not null, "active" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "transport_vehicle_class_pkey" primary key ("id"));')
    this.addSql('create table if not exists "transport_reservation" ("id" text not null, "order_id" text not null, "cart_id" text not null, "line_item_id" text not null, "status" text not null default \'confirmed\', "quote_snapshot" jsonb not null, "order_snapshot" jsonb not null, "confirmed_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "transport_reservation_pkey" primary key ("id"));')
    this.addSql('create table if not exists "transport_reservation_hold" ("id" text not null, "quote_id" text not null, "cart_id" text not null, "status" text not null default \'active\', "expires_at" timestamptz not null, "reservation_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "transport_reservation_hold_pkey" primary key ("id"));')
    this.addSql('create table if not exists "transport_reservation_change" ("id" text not null, "reservation_id" text not null, "change_request_id" text not null, "status" text not null default \'pending_payment\', "delta_amount" integer not null, "payment_link_status" text null, "refund_status" text null, "error_code" text null, "reason" text null, "previous_quote_snapshot" jsonb not null, "requested_quote_snapshot" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "transport_reservation_change_pkey" primary key ("id"));')
    this.addSql('create table if not exists "transport_provider_event" ("id" text not null, "provider_event_id" text not null, "change_request_id" text not null, "provider_status" text not null, "change_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "transport_provider_event_pkey" primary key ("id"));')
    this.addSql('create table if not exists "transport_audit_event" ("id" text not null, "reservation_id" text not null, "event_type" text not null, "snapshot" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "transport_audit_event_pkey" primary key ("id"));')
    this.addSql('create index if not exists "IDX_transport_reservation_order_line" on "transport_reservation" ("order_id", "line_item_id") where deleted_at is null;')
    this.addSql('create index if not exists "IDX_transport_audit_reservation" on "transport_audit_event" ("reservation_id") where deleted_at is null;')
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "transport_audit_event" cascade;')
    this.addSql('drop table if exists "transport_provider_event" cascade;')
    this.addSql('drop table if exists "transport_reservation_change" cascade;')
    this.addSql('drop table if exists "transport_reservation_hold" cascade;')
    this.addSql('drop table if exists "transport_reservation" cascade;')
    this.addSql('drop table if exists "transport_vehicle_class" cascade;')
    this.addSql('drop table if exists "transport_zone_cell" cascade;')
    this.addSql('drop table if exists "transport_zone" cascade;')
  }
}
