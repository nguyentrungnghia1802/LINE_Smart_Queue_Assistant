import type { LineNotificationCopy } from './types';

export const viLineNotificationCopy: LineNotificationCopy = {
  locale: 'vi',
  systemName: 'LINE Smart Queue Assistant',
  labels: {
    ticket: 'Mã lượt',
    status: 'Trạng thái',
    ahead: 'Số người phía trước',
    eta: 'Thời gian chờ dự kiến',
    openTicket: 'Mở thông tin lượt',
    ticketLink: 'Thông tin lượt',
  },
  values: {
    checking: 'Đang kiểm tra',
    none: 'Không có',
    soon: 'Sắp đến lượt',
    people: (count) => `${count} người`,
    minutes: (count) => `Khoảng ${count} phút`,
    hours: (hours, minutes) =>
      minutes === 0 ? `Khoảng ${hours} giờ` : `Khoảng ${hours} giờ ${minutes} phút`,
  },
  events: {
    booking_created: {
      headline: 'Đã tiếp nhận đặt chỗ',
      status: 'Đã tiếp nhận',
      guidance: 'Vui lòng theo dõi thông tin lượt trong khi chờ đến gần lượt.',
      accentColor: '#06C755',
    },
    eta_warning: {
      headline: 'Sắp đến lượt của bạn',
      status: 'Đang đến gần lượt',
      guidance: 'Vui lòng quay lại và chờ gần quầy.',
      accentColor: '#F59E0B',
    },
    called: {
      headline: 'Đã đến lượt của bạn',
      status: 'Đang gọi',
      guidance: 'Vui lòng đến quầy phục vụ.',
      accentColor: '#06C755',
    },
    serving: {
      headline: 'Đã bắt đầu phục vụ',
      status: 'Đang phục vụ',
      guidance: 'Vui lòng làm theo hướng dẫn của nhân viên.',
      accentColor: '#2563EB',
    },
    completed: {
      headline: 'Đã hoàn thành phục vụ',
      status: 'Hoàn thành',
      guidance: 'Cảm ơn bạn đã sử dụng dịch vụ.',
      accentColor: '#4B5563',
    },
    cancelled: {
      headline: 'Đã hủy lượt',
      status: 'Đã hủy',
      guidance: 'Vui lòng đặt lại nếu bạn vẫn cần sử dụng dịch vụ.',
      accentColor: '#DC2626',
    },
    no_show: {
      headline: 'Đã ghi nhận vắng mặt',
      status: 'Vắng mặt',
      guidance: 'Vui lòng liên hệ nhân viên nếu bạn vẫn cần được hỗ trợ.',
      accentColor: '#EA580C',
    },
    location_warning: {
      headline: 'Vui lòng kiểm tra khoảng cách tới cửa hàng',
      status: 'Nhắc quay lại',
      guidance: 'Sắp đến lượt của bạn. Vui lòng quay lại cửa hàng sớm.',
      accentColor: '#0F766E',
    },
  },
  statuses: {
    waiting: 'Đang chờ',
    called: 'Đang gọi',
    serving: 'Đang phục vụ',
    served: 'Hoàn thành',
    completed: 'Hoàn thành',
    cancelled: 'Đã hủy',
    skipped: 'Đã lùi lượt',
    no_show: 'Vắng mặt',
  },
  commands: {
    welcome:
      'Chào mừng bạn đến với LINE Smart Queue Assistant.\n\nQuét mã QR tại cửa hàng để nhận mã lượt.\nGửi "STATUS" để xem lượt hiện tại hoặc "HELP" để xem hướng dẫn.',
    help: 'Lệnh hỗ trợ:\nSTATUS - Xem lượt hiện tại\nCANCEL - Hủy lượt hiện tại\nHELP - Hiển thị hướng dẫn này',
    noActive:
      'Bạn không có lượt đang hoạt động.\nHãy quét mã QR tại cửa hàng để tham gia hàng đợi.',
    activeHeader: 'Lượt hiện tại:',
    noCancellable: 'Không có lượt đang hoạt động có thể hủy.',
    cancelSucceeded: 'Đã hủy lượt.',
    cancelFailed: 'Không thể hủy lượt. Lượt có thể đã được xử lý.',
    skipSucceeded: (ticketCode) => `Đã lùi mã lượt ${ticketCode} xuống một vị trí.`,
    skipFailed: 'Không thể lùi lượt. Vui lòng thử lại.',
    unknown: 'Gửi "HELP" để xem hướng dẫn sử dụng.',
  },
};
