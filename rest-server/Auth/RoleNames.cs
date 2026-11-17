namespace RestServer.Auth;

public static class RoleNames
{
    public const string Admin = "Admin";
    public const string EventManager = "Event Manager";
    public const string MarketingManager = "Marketing Manager";
    public const string StandardUser = "Standard User";
    public const string All = Admin + "," + EventManager + "," + MarketingManager + "," + StandardUser;
    public const string EventManagement = Admin + "," + EventManager;
    public const string Analytics = EventManagement + "," + MarketingManager;

    // FR-12 (updated): Admin, Event Manager and Marketing Manager may do everything the Admin can,
    // except creating/deleting accounts, changing roles and touching Admin accounts (Admin only).
    public const string Managers = Admin + "," + EventManager + "," + MarketingManager;
}
