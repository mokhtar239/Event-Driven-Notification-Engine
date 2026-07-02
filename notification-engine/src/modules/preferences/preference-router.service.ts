import { Injectable, Logger } from '@nestjs/common';
import { ChannelType } from '../../common/enums/channel-type.enum';
import { EventPriority } from '../../common/enums/event-priority.enum';
import { PreferencesService } from './preferences.service';
import {
  ChannelPreferences,
  QuietHours,
  DigestMode,
} from './schemas/user-preference.schema';


export interface RoutingDecision {
  channels: ChannelType[];
  suppressed: boolean;
  reason?: string;
  decisions: ChannelDecision[];
  digestMode: DigestMode;
}

export interface ChannelDecision {
  channel: ChannelType;
  kept: boolean;
  reason: string;
}

@Injectable()
export class PreferenceRouter {
  private readonly logger = new Logger(PreferenceRouter.name);

  constructor(private readonly preferences: PreferencesService) {}

  async route(
    tenantId: string,
    userId: string,
    eventType: string,
    candidateChannels: ChannelType[],
    priority: EventPriority,
  ): Promise<RoutingDecision> {
    const prefs = await this.preferences.getOrCreate(tenantId, userId);
    const isUrgent =
      priority === EventPriority.CRITICAL || priority === EventPriority.HIGH;

    if (!isUrgent && this.isMuted(eventType, prefs.mutedEvents)) {
      const decision: RoutingDecision = {
        channels: [],
        suppressed: true,
        reason: `event '${eventType}' is muted`,
        decisions: candidateChannels.map((channel) => ({
          channel,
          kept: false,
          reason: 'event muted',
        })),
        digestMode: prefs.digestMode,
      };
      this.log(tenantId, userId, eventType, decision);
      return decision;
    }

    const decisions: ChannelDecision[] = [];
    let channels = candidateChannels.filter((channel) => {
      const enabled = this.isChannelEnabled(channel, prefs.channels);
      decisions.push({
        channel,
        kept: enabled,
        reason: enabled ? 'channel enabled' : 'channel opted out',
      });
      return enabled;
    });

    if (channels.length > 0 && this.inQuietHours(prefs.quietHours)) {
      if (isUrgent) {
        for (const d of decisions) {
          if (d.kept) d.reason = 'quiet hours bypassed (high priority)';
        }
      } else {
        for (const d of decisions) {
          if (d.kept) {
            d.kept = false;
            d.reason = 'within quiet hours';
          }
        }
        channels = [];
        const decision: RoutingDecision = {
          channels: [],
          suppressed: true,
          reason: 'within quiet hours',
          decisions,
          digestMode: prefs.digestMode,
        };
        this.log(tenantId, userId, eventType, decision);
        return decision;
      }
    }

    const decision: RoutingDecision = {
      channels,
      suppressed: channels.length === 0,
      reason: channels.length === 0 ? 'all channels opted out' : undefined,
      decisions,
      digestMode: prefs.digestMode,
    };
    this.log(tenantId, userId, eventType, decision);
    return decision;
  }

  private isMuted(eventType: string, mutedEvents: string[]): boolean {
    return mutedEvents.some((pattern) => {
      if (pattern === eventType) return true;
      if (pattern.endsWith('.*')) {
        const prefix = pattern.slice(0, -2);
        return eventType === prefix || eventType.startsWith(prefix + '.');
      }
      return false;
    });
  }

  private isChannelEnabled(
    channel: ChannelType,
    channels: ChannelPreferences,
  ): boolean {
    switch (channel) {
      case ChannelType.EMAIL:
        return channels.email;
      case ChannelType.SMS:
        return channels.sms;
      case ChannelType.PUSH:
        return channels.push;
      case ChannelType.INAPP:
        return channels.inapp;
      default:
        return false;
    }
  }

  private inQuietHours(quietHours: QuietHours): boolean {
    const { start, end, timezone } = quietHours;
    if (!start || !end) return false;

    const nowMinutes = this.nowMinutesInZone(timezone || 'UTC');
    const startMinutes = this.parseHHmm(start);
    const endMinutes = this.parseHHmm(end);
    if (startMinutes === null || endMinutes === null) return false;

    if (startMinutes <= endMinutes) {
      return nowMinutes >= startMinutes && nowMinutes < endMinutes;
    }
    return nowMinutes >= startMinutes || nowMinutes < endMinutes;
  }

  private parseHHmm(value: string): number | null {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    return hours * 60 + minutes;
  }

  private nowMinutesInZone(timezone: string): number {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(new Date());
      const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
      const minute = Number(
        parts.find((p) => p.type === 'minute')?.value ?? '0',
      );
      return (hour % 24) * 60 + minute;
    } catch {
      this.logger.warn(
        `Invalid timezone '${timezone}', falling back to UTC for quiet-hours check`,
      );
      const now = new Date();
      return now.getUTCHours() * 60 + now.getUTCMinutes();
    }
  }

  private log(
    tenantId: string,
    userId: string,
    eventType: string,
    decision: RoutingDecision,
  ): void {
    this.logger.log(
      `Routing decision: event=${eventType} tenant=${tenantId} user=${userId} ` +
        `final=[${decision.channels.join(', ')}] suppressed=${decision.suppressed}` +
        (decision.reason ? ` reason='${decision.reason}'` : ''),
      {
        tenantId,
        userId,
        eventType,
        finalChannels: decision.channels,
        suppressed: decision.suppressed,
        decisions: decision.decisions,
      },
    );
  }
}
