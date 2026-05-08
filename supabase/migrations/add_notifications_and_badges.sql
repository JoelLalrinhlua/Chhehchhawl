-- ============================================================
-- Chhehchhawl – Notifications & Badge Count Migration
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Add reference columns to notifications table
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='reference_id') THEN
        ALTER TABLE notifications ADD COLUMN reference_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='reference_type') THEN
        ALTER TABLE notifications ADD COLUMN reference_type TEXT DEFAULT 'task';
    END IF;
END $$;

-- 2. get_my_notifications – returns extended notification list
CREATE OR REPLACE FUNCTION get_my_notifications(p_user_id UUID)
RETURNS TABLE (
    id UUID, type TEXT, task_id UUID, title TEXT, body TEXT,
    read BOOLEAN, created_at TIMESTAMPTZ, reference_id TEXT, reference_type TEXT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT n.id, n.type::TEXT, n.task_id, n.title, n.body, n.read, n.created_at,
           COALESCE(n.reference_id, n.task_id::TEXT) AS reference_id,
           COALESCE(n.reference_type, 'task') AS reference_type
    FROM notifications n
    WHERE n.user_id = p_user_id
    ORDER BY n.created_at DESC LIMIT 100;
END; $$;

-- 3. get_unread_notification_count
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE cnt INTEGER;
BEGIN
    SELECT COUNT(*)::INTEGER INTO cnt FROM notifications WHERE user_id=p_user_id AND read=FALSE;
    RETURN COALESCE(cnt,0);
END; $$;

-- 4. Helper: create_notification
CREATE OR REPLACE FUNCTION create_notification(
    p_user_id UUID, p_type TEXT, p_task_id UUID,
    p_title TEXT, p_body TEXT,
    p_reference_id TEXT DEFAULT NULL, p_reference_type TEXT DEFAULT 'task'
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO notifications(user_id,type,task_id,title,body,read,created_at,reference_id,reference_type)
    VALUES(p_user_id,p_type,p_task_id,p_title,p_body,FALSE,NOW(),p_reference_id,p_reference_type);
END; $$;

-- 5. Trigger: poster notified when application received
CREATE OR REPLACE FUNCTION notify_poster_on_application()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_title TEXT; v_name TEXT; v_poster UUID;
BEGIN
    IF TG_OP='INSERT' AND NEW.status='pending' THEN
        SELECT title,created_by INTO v_title,v_poster FROM tasks WHERE id=NEW.task_id;
        SELECT full_name INTO v_name FROM profiles WHERE id=NEW.applicant_id;
        IF v_poster IS NOT NULL AND v_poster!=NEW.applicant_id THEN
            PERFORM create_notification(v_poster,'application_received',NEW.task_id,
                'New Application 📋',
                COALESCE(v_name,'Someone')||' applied to "'||COALESCE(v_title,'your task')||'"',
                NEW.task_id::TEXT,'task');
        END IF;
    END IF;
    RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_poster_on_application ON task_applications;
CREATE TRIGGER trg_notify_poster_on_application
AFTER INSERT ON task_applications FOR EACH ROW EXECUTE FUNCTION notify_poster_on_application();

-- 6. Trigger: tasker notified when application accepted/rejected
CREATE OR REPLACE FUNCTION notify_tasker_on_app_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_title TEXT; v_poster_name TEXT; v_poster UUID;
BEGIN
    IF TG_OP='UPDATE' AND OLD.status='pending' AND NEW.status IN ('accepted','rejected') THEN
        SELECT title,created_by INTO v_title,v_poster FROM tasks WHERE id=NEW.task_id;
        SELECT full_name INTO v_poster_name FROM profiles WHERE id=v_poster;
        IF NEW.status='accepted' THEN
            PERFORM create_notification(NEW.applicant_id,'application_accepted',NEW.task_id,
                'Application Accepted! 🎉',
                'You were accepted for "'||COALESCE(v_title,'a task')||'"',
                NEW.task_id::TEXT,'task');
        ELSE
            PERFORM create_notification(NEW.applicant_id,'application_rejected',NEW.task_id,
                'Application Update',
                'Your application for "'||COALESCE(v_title,'a task')||'" was not selected',
                NEW.task_id::TEXT,'task');
        END IF;
    END IF;
    RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_tasker_on_app_update ON task_applications;
CREATE TRIGGER trg_notify_tasker_on_app_update
AFTER UPDATE ON task_applications FOR EACH ROW EXECUTE FUNCTION notify_tasker_on_app_update();

-- 7. Trigger: new message notification
CREATE OR REPLACE FUNCTION notify_on_new_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_poster UUID; v_tasker UUID; v_task UUID; v_recipient UUID; v_sender_name TEXT; v_title TEXT;
BEGIN
    IF NEW.message_type NOT IN ('system','location_request','location_response','location_offer') THEN
        SELECT cr.poster_id,cr.tasker_id,cr.task_id INTO v_poster,v_tasker,v_task
        FROM chat_rooms cr WHERE cr.id=NEW.room_id;
        IF v_task IS NOT NULL THEN
            SELECT title INTO v_title FROM tasks WHERE id=v_task;
            v_recipient := CASE WHEN NEW.sender_id=v_poster THEN v_tasker ELSE v_poster END;
            SELECT full_name INTO v_sender_name FROM profiles WHERE id=NEW.sender_id;
            PERFORM create_notification(v_recipient,'new_message',v_task,
                COALESCE(v_sender_name,'Someone')||' sent a message',
                CASE NEW.message_type
                    WHEN 'image' THEN '📷 Photo'
                    WHEN 'location_share' THEN '📍 Shared a location'
                    WHEN 'payment_request' THEN '💳 Payment request'
                    ELSE CASE WHEN LENGTH(NEW.message)>60 THEN LEFT(NEW.message,60)||'…' ELSE NEW.message END
                END,
                NEW.room_id::TEXT,'chat');
        END IF;
    END IF;
    RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_on_new_message ON messages;
CREATE TRIGGER trg_notify_on_new_message
AFTER INSERT ON messages FOR EACH ROW EXECUTE FUNCTION notify_on_new_message();

-- 8. Trigger: task status notifications
CREATE OR REPLACE FUNCTION notify_on_task_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF OLD.status!='completed' AND NEW.status='completed' AND NEW.tasker_id IS NOT NULL THEN
        PERFORM create_notification(NEW.created_by,'task_completed',NEW.id,'Task Completed! ✅',
            '"'||NEW.title||'" has been completed',NEW.id::TEXT,'task');
        PERFORM create_notification(NEW.tasker_id,'task_completed',NEW.id,'Task Completed! 🎉',
            'Payment confirmed for "'||NEW.title||'"',NEW.id::TEXT,'task');
    END IF;
    IF OLD.status!='pending_confirmation' AND NEW.status='pending_confirmation' THEN
        PERFORM create_notification(NEW.created_by,'task_pending_confirmation',NEW.id,'Payment Requested 💳',
            'Your tasker completed "'||NEW.title||'" and awaits payment',NEW.id::TEXT,'task');
    END IF;
    RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_on_task_status ON tasks;
CREATE TRIGGER trg_notify_on_task_status
AFTER UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION notify_on_task_status();

-- 9. get_new_applicants_count (for badge on tasks tab)
CREATE OR REPLACE FUNCTION get_new_applicants_count(p_user_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE cnt INTEGER;
BEGIN
    SELECT COUNT(*)::INTEGER INTO cnt
    FROM task_applications ta JOIN tasks t ON t.id=ta.task_id
    WHERE t.created_by=p_user_id AND ta.status='pending';
    RETURN COALESCE(cnt,0);
END; $$;
