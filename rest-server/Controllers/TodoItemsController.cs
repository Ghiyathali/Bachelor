using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestServer.Data;
using RestServer.Models;

namespace RestServer.Controllers;

[ApiController]
[Route("api/todos")]
public class TodoItemsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<TodoItem>>> GetAll() =>
        await db.TodoItems.AsNoTracking().OrderByDescending(item => item.CreatedAt).ToListAsync();

    [HttpGet("{id:int}")]
    public async Task<ActionResult<TodoItem>> GetById(int id)
    {
        var item = await db.TodoItems.FindAsync(id);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost]
    public async Task<ActionResult<TodoItem>> Create(TodoItem item)
    {
        db.TodoItems.Add(item);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = item.Id }, item);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, TodoItem input)
    {
        if (id != input.Id) return BadRequest();
        if (!await db.TodoItems.AnyAsync(item => item.Id == id)) return NotFound();

        db.Entry(input).State = EntityState.Modified;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await db.TodoItems.FindAsync(id);
        if (item is null) return NotFound();

        db.TodoItems.Remove(item);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
