// Run the test classes one after another, never at the same time.
//
// Every test class gets its own ApiFactory, which starts its own PostgreSQL container
// and tells the API which database to use through process-wide environment variables
// (ConnectionStrings__Postgres). When two classes run in parallel, the second can
// overwrite the first one's connection string, and the first class's tests then lose
// their database when the other class finishes ("unexpected postmaster exit").
//
// [Collection("API integration")] on single classes solved this only for the classes
// that had it. This assembly-wide setting covers every test class, including new ones.
[assembly: CollectionBehavior(DisableTestParallelization = true)]
