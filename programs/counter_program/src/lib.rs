use anchor_lang::prelude::*;

declare_id!("62Hak3ofdbk9XoEKByZ4WSmz5TtFsvHwcz81mRXvkvoh");

#[program]
pub mod counter_program {
    use super::*;

    /// Инициализирует новый счётчик для пользователя.
    /// Счётчик хранится в PDA (Program Derived Address) — адрес,
    /// который детерминированно выводится из seeds, а не из случайной пары ключей.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = 0;
        counter.authority = ctx.accounts.authority.key();
        Ok(())
    }

    /// Увеличивает счётчик на 1. Может вызвать только authority (владелец счётчика).
    pub fn increment(ctx: Context<Update>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = counter
            .count
            .checked_add(1)
            .ok_or(CounterError::Overflow)?;
        Ok(())
    }

    /// Уменьшает счётчик на 1, но не позволяет уйти в минус.
    pub fn decrement(ctx: Context<Update>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = counter
            .count
            .checked_sub(1)
            .ok_or(CounterError::Underflow)?;
        Ok(())
    }
}

/// Данные, которые хранит наш on-chain аккаунт-счётчик.
#[account]
pub struct Counter {
    pub count: u64,
    pub authority: Pubkey,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 8 + 32, // 8 байт дискриминатор + 8 байт u64 + 32 байта Pubkey
        seeds = [b"counter", authority.key().as_ref()],
        bump
    )]
    pub counter: Account<'info, Counter>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Update<'info> {
    #[account(
        mut,
        seeds = [b"counter", authority.key().as_ref()],
        bump,
        has_one = authority // проверяет, что counter.authority == authority.key()
    )]
    pub counter: Account<'info, Counter>,
    pub authority: Signer<'info>,
}

#[error_code]
pub enum CounterError {
    #[msg("Счётчик переполнен")]
    Overflow,
    #[msg("Счётчик не может быть меньше нуля")]
    Underflow,
}