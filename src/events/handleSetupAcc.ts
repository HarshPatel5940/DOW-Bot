import {
  ActionRowBuilder,
  Events,
  type Interaction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

export default {
  name: Events.InteractionCreate,
  once: false,

  async execute(interaction: Interaction) {
    if (!interaction.isButton()) return;
    if (!interaction.guild) return;

    if (interaction.customId === 'add-nickname') {
      const Name = new TextInputBuilder()
        .setCustomId('add-nick-t')
        .setLabel('Seu nome de usuário Apex')
        .setStyle(TextInputStyle.Short)
        .setMinLength(3)
        .setMaxLength(50);

      const FirstActionRow =
        new ActionRowBuilder<TextInputBuilder>().addComponents(Name);
      const modal = new ModalBuilder()
        .setCustomId(`add-nickname-${interaction.user.id}`)
        .setTitle('Digite seu apelido');
      modal.addComponents(FirstActionRow);

      await interaction.showModal(modal);
    }
  },
};
