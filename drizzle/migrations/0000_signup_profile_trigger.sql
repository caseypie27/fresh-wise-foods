DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_items, public.notification_preferences, public.push_subscriptions, public.user_locations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.food_items, public.notification_preferences, public.profiles, public.push_subscriptions, public.user_locations TO service_role;