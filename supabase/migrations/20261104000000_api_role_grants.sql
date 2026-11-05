-- State the API roles' privileges on public explicitly (PLA-143).
--
-- Every table and function in public got its privileges for anon,
-- authenticated and service_role from the schema's default privileges, never
-- from a GRANT. Hosted databases Supabase creates today (a new branch, a
-- restore into a new project) come with far narrower defaults, so on those
-- every table arrives unreadable through the API.
--
-- This file restates, object by object, the privileges the local stack's
-- catalog holds, including what earlier migrations narrowed on purpose
-- (UPDATE on plans, the RPCs revoked from anon). On a database that already
-- has them, local and production, it changes nothing. The lines were
-- generated from that catalog, not written by hand.
--
-- The default privileges at the end cover objects that later migrations
-- create, so a new table or function needs no line here.

-- Tables
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.app_admins to anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.blocked_users to anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.cities to anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.content_reports to anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.date_availability to anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.feedback to anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.friendships to anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.group_invites to anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.group_members to anon, authenticated, service_role;
grant insert, update, delete, truncate, references, trigger, maintain on table public.groups to anon, authenticated;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.groups to service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.notifications to anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.plan_date_options to anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.plan_photos to anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.plan_poll_options to anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.plan_poll_vote_receipts to anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.plan_poll_votes to anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.plan_polls to anon, authenticated, service_role;
grant select, insert, truncate, references, trigger, maintain on table public.plans to anon, authenticated;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.plans to service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.profiles to anon, authenticated, service_role;
grant select, delete, truncate, references, trigger, maintain on table public.rsvps to anon, authenticated;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.rsvps to service_role;

-- Functions
grant execute on function public.assign_waitlist_seq() to anon, authenticated, service_role;
grant execute on function public.can_add_plan_photo(p_plan_id uuid) to anon, authenticated, service_role;
grant execute on function public.can_manage_plan_poll(p_plan_id uuid) to anon, authenticated, service_role;
grant execute on function public.can_view_plan(p_plan_id uuid) to anon, authenticated, service_role;
grant execute on function public.can_view_plan(p_plan_id uuid, p_audience text, p_group_id uuid, p_created_by uuid) to anon, authenticated, service_role;
grant execute on function public.can_view_plan_photos(p_plan_id uuid) to anon, authenticated, service_role;
grant execute on function public.can_vote_plan_poll(p_poll_id uuid) to anon, authenticated, service_role;
grant execute on function public.cancel_plan(p_plan_id uuid, p_reason text) to authenticated, service_role;
grant execute on function public.claim_feedback_for_linear(p_feedback_id uuid) to authenticated, service_role;
grant execute on function public.cleanup_user_on_leave_group() to anon, authenticated, service_role;
grant execute on function public.color_for_name(p_name text) to anon, authenticated, service_role;
grant execute on function public.create_group(p_name text, p_city_id uuid, p_description text, p_color text) to authenticated, service_role;
grant execute on function public.delete_my_account() to anon, authenticated, service_role;
grant execute on function public.dismiss_feedback(p_feedback_id uuid) to authenticated, service_role;
grant execute on function public.dissolve_block_ties(p_blocker uuid, p_blocked uuid) to service_role;
grant execute on function public.dissolve_on_block() to service_role;
grant execute on function public.enforce_last_admin_floor() to anon, authenticated, service_role;
grant execute on function public.enforce_photo_caps() to anon, authenticated, service_role;
grant execute on function public.enforce_plan_cap() to anon, authenticated, service_role;
grant execute on function public.file_report(p_subject_type text, p_subject_id uuid, p_reason text, p_note text, p_block_user_id uuid) to authenticated, service_role;
grant execute on function public.friend_ids(p_user uuid) to service_role;
grant execute on function public.generate_handle(p_base text) to authenticated, service_role;
grant execute on function public.generate_invite_code() to anon, authenticated, service_role;
grant execute on function public.get_group_by_invite_code(code text) to authenticated, service_role;
grant execute on function public.get_group_invite_code(p_group_id uuid) to authenticated, service_role;
grant execute on function public.handle_new_user() to anon, authenticated, service_role;
grant execute on function public.invite_to_group(p_group_id uuid, p_invitee uuid) to authenticated, service_role;
grant execute on function public.is_app_admin() to authenticated, service_role;
grant execute on function public.is_blocked_by(p_other uuid) to anon, authenticated, service_role;
grant execute on function public.is_friend(p_other uuid) to anon, authenticated, service_role;
grant execute on function public.is_friend_of_friend(p_other uuid) to anon, authenticated, service_role;
grant execute on function public.is_group_admin(check_group_id uuid) to anon, authenticated, service_role;
grant execute on function public.is_group_image_admin(object_name text) to authenticated, service_role;
grant execute on function public.is_group_member(check_group_id uuid) to anon, authenticated, service_role;
grant execute on function public.is_plan_host(p_group_id uuid, p_created_by uuid) to authenticated, service_role;
grant execute on function public.join_group_by_invite_code(p_code text) to authenticated, service_role;
grant execute on function public.leave_group(p_group_id uuid) to authenticated, service_role;
grant execute on function public.lock_plan(p_plan_id uuid, p_date_option_id uuid) to authenticated, service_role;
grant execute on function public.mint_invite_code(p_group_id uuid) to service_role;
grant execute on function public.notify_plan_created() to anon, authenticated, service_role;
grant execute on function public.notify_plan_poll_opened() to anon, authenticated, service_role;
grant execute on function public.plan_album_card(p_plan_id uuid) to anon, authenticated, service_role;
grant execute on function public.plan_audience_recipients(p_audience text, p_group_id uuid, p_created_by uuid) to service_role;
grant execute on function public.plan_bridge(plans) to anon, authenticated, service_role;
grant execute on function public.plan_photo_plan_id(p_name text) to anon, authenticated, service_role;
grant execute on function public.promote_from_waitlist() to anon, authenticated, service_role;
grant execute on function public.push_notification_webhook() to anon, authenticated, service_role;
grant execute on function public.record_feedback_linear_issue(p_feedback_id uuid, p_linear_issue_id uuid, p_linear_issue_identifier text, p_linear_issue_url text) to authenticated, service_role;
grant execute on function public.release_feedback_from_linear(p_feedback_id uuid) to authenticated, service_role;
grant execute on function public.remember_plan_poll_vote() to anon, authenticated, service_role;
grant execute on function public.remove_group_member(p_group_id uuid, p_user_id uuid) to authenticated, service_role;
grant execute on function public.reopen_feedback(p_feedback_id uuid) to authenticated, service_role;
grant execute on function public.reopen_plan(p_plan_id uuid) to authenticated, service_role;
grant execute on function public.respond_friend_request(p_friendship_id uuid, p_accept boolean) to authenticated, service_role;
grant execute on function public.respond_group_invite(p_invite_id uuid, p_accept boolean) to authenticated, service_role;
grant execute on function public.respond_to_join_request(p_group_id uuid, p_user_id uuid, p_approve boolean) to authenticated, service_role;
grant execute on function public.restore_plan(p_plan_id uuid) to authenticated, service_role;
grant execute on function public.rotate_invite_code(p_group_id uuid) to authenticated, service_role;
grant execute on function public.search_people(p_query text) to authenticated, service_role;
grant execute on function public.send_friend_request(p_addressee uuid) to authenticated, service_role;
grant execute on function public.set_group_notify(p_group_id uuid, p_notify boolean) to authenticated, service_role;
grant execute on function public.update_group_door(p_group_id uuid, p_who_can_invite text, p_join_mode text) to authenticated, service_role;
grant execute on function public.update_updated_at_column() to anon, authenticated, service_role;

-- Default privileges for what postgres creates in public from here on
alter default privileges for role postgres in schema public grant select, insert, update, delete, truncate, references, trigger, maintain on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant select, update, usage on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant execute on functions to anon, authenticated, service_role;
